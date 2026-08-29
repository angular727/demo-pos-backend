const Inventory = require('./inventoryModel'); // Adjust path
const Product = require('../product/productModel'); // Adjust path
const mongoose = require('mongoose');

/**
 * Unified Inventory Analytics Controller
 * Single endpoint that handles all analytics based on query parameters
 * 
 * Route: GET /api/inventory/stock-overview/:pagesize/:page/:ordering?
 */

// Helper function to build date range filter
const buildDateFilter = (startDate, endDate, field = 'createdAt') => {
    const filter = {};
    if (startDate || endDate) {
        filter[field] = {};
        if (startDate) filter[field].$gte = new Date(startDate);
        if (endDate) filter[field].$lte = new Date(endDate);
    }
    return filter;
};

/**
 * Main unified analytics handler
 * Determines which analytics method to call based on query params
 */
const stockOverview = async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const pageSize = parseInt(req.params.pagesize) || 10;
        const sortOrder = req.params.ordering === 'desc' ? -1 : 1;
        const skip = (page - 1) * pageSize;

        const query = req.query;

        // Determine which analytics method to call based on query params
        let result;

        if (query.type === 'overview' || query.overview === 'true') {
            // Dashboard overview
            result = await getDashboardOverview(query);
        } 
        else if (query.type === 'category' || query.groupBy === 'category') {
            // Category-wise analytics
            result = await getCategoryAnalytics(query, page, pageSize, skip, sortOrder);
        } 
        else if (query.type === 'expiry' || query.expiryAnalysis === 'true') {
            // Expiry focused analytics
            result = await getExpiryAnalytics(query, page, pageSize, skip, sortOrder);
        } 
        else if (query.type === 'location' || query.groupBy === 'location') {
            // Location-based analytics
            result = await getLocationAnalytics(query, page, pageSize, skip, sortOrder);
        } 
        else if (query.type === 'trends' || query.trends === 'true') {
            // Time-based trends
            result = await getTrendsAnalytics(query);
        } 
        else if (query.type === 'search' || query.q) {
            // Search inventory
            result = await searchInventory(query, page, pageSize, skip);
        } 
        else if (query.productRef || query.singleProduct === 'true') {
            // Single product detailed analytics
            result = await getSingleProductAnalytics(query, page, pageSize, skip);
        } 
        else {
            // Default: Main inventory analytics with filters
            result = await getMainAnalytics(query, page, pageSize, skip, sortOrder);
        }

        res.status(200).json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Stock Overview Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stock overview',
            error: error.message
        });
    }
};

/**
 * Main Analytics - Default handler
 * Filters: stockStatus, productName, productId, category, subcategory, brand,
 *          minStock, maxStock, minPrice, maxPrice, dates, location, etc.
 */
const getMainAnalytics = async (query, page, pageSize, skip, sortOrder) => {
    const {
        // Stock status
        stockStatus, // 'active', 'zero', 'low', 'all'
        
        // Product filters
        productName,
        productId,
        productRef,
        
        // Category filters
        category,
        categoryRef,
        subcategory,
        brand,
        
        // Inventory filters
        batchNumber,
        minStock,
        maxStock,
        minPrice,
        maxPrice,
        
        // Date filters
        startDate,
        endDate,
        expiryStartDate,
        expiryEndDate,
        
        // Location
        place,
        placeNo,
        
        // Options
        sortBy = 'totalInventory',
        groupByProduct = 'true',
        includeExpired = 'true',
        purchaseReturn
    } = query;

    // Build match conditions
    const matchConditions = {};

    // Stock status filter
    if (stockStatus === 'active') {
        matchConditions.totalInventory = { $gt: 0 };
    } else if (stockStatus === 'zero') {
        matchConditions.totalInventory = { $eq: 0 };
    } else if (stockStatus === 'low') {
        matchConditions.$expr = {
            $lte: ['$totalInventory', { $ifNull: [{ $toInt: '$limit' }, 10] }]
        };
        matchConditions.totalInventory = { $gt: 0 };
    }

    // Stock range
    if (minStock !== undefined || maxStock !== undefined) {
        matchConditions.totalInventory = matchConditions.totalInventory || {};
        if (minStock !== undefined) matchConditions.totalInventory.$gte = parseInt(minStock);
        if (maxStock !== undefined) matchConditions.totalInventory.$lte = parseInt(maxStock);
    }

    // Price range
    if (minPrice !== undefined || maxPrice !== undefined) {
        matchConditions.totalPrice = {};
        if (minPrice !== undefined) matchConditions.totalPrice.$gte = parseFloat(minPrice);
        if (maxPrice !== undefined) matchConditions.totalPrice.$lte = parseFloat(maxPrice);
    }

    // Product filters
    if (productName) {
        matchConditions.productName = { $regex: productName, $options: 'i' };
    }
    if (productId) {
        matchConditions.productId = parseInt(productId);
    }
    if (productRef) {
        matchConditions.productRef = new mongoose.Types.ObjectId(productRef);
    }

    // Batch number
    if (batchNumber) {
        matchConditions.batchNumber = { $regex: batchNumber, $options: 'i' };
    }

    // Date filters
    if (startDate || endDate) {
        Object.assign(matchConditions, buildDateFilter(startDate, endDate, 'createdAt'));
    }

    // Expiry date filters
    if (expiryStartDate || expiryEndDate) {
        matchConditions.expiryDate = {};
        if (expiryStartDate) matchConditions.expiryDate.$gte = new Date(expiryStartDate);
        if (expiryEndDate) matchConditions.expiryDate.$lte = new Date(expiryEndDate);
    }

    // Exclude expired
    if (includeExpired === 'false') {
        matchConditions.expiryDate = matchConditions.expiryDate || {};
        matchConditions.expiryDate.$gte = new Date();
    }

    // Location
    if (place) {
        matchConditions.place = { $regex: place, $options: 'i' };
    }
    if (placeNo) {
        matchConditions.placeNo = placeNo;
    }

    // Purchase return
    if (purchaseReturn !== undefined) {
        matchConditions.purchaseReturn = purchaseReturn === 'true';
    }

    let results, totalCount, summary;

    if (groupByProduct === 'true') {
        // Grouped by product
        const pipeline = [
            { $match: matchConditions },
            {
                $lookup: {
                    from: 'products',
                    localField: 'productRef',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
            
            // Product-level filters
            ...(category ? [{ $match: { 'productDetails.categoryName': { $regex: category, $options: 'i' } } }] : []),
            ...(categoryRef ? [{ $match: { 'productDetails.categoryRef': new mongoose.Types.ObjectId(categoryRef) } }] : []),
            ...(subcategory ? [{ $match: { 'productDetails.subcategory': { $regex: subcategory, $options: 'i' } } }] : []),
            ...(brand ? [{ $match: { 'productDetails.brand': { $regex: brand, $options: 'i' } } }] : []),
            
            // Group by product
            {
                $group: {
                    _id: '$productRef',
                    productId: { $first: '$productId' },
                    productName: { $first: '$productName' },
                    productDetails: { $first: '$productDetails' },
                    totalStock: { $sum: '$totalInventory' },
                    totalUnits: { $sum: '$totalUnits' },
                    totalPacks: { $sum: '$packQuantity' },
                    batchCount: { $sum: 1 },
                    activeBatches: { $sum: { $cond: [{ $gt: ['$totalInventory', 0] }, 1, 0] } },
                    zeroBatches: { $sum: { $cond: [{ $eq: ['$totalInventory', 0] }, 1, 0] } },
                    totalValue: { $sum: '$totalPrice' },
                    avgUnitPrice: { $avg: '$unitPrice' },
                    avgSalePrice: { $avg: '$salePrice' },
                    minUnitPrice: { $min: '$unitPrice' },
                    maxUnitPrice: { $max: '$unitPrice' },
                    oldestBatch: { $min: '$createdAt' },
                    newestBatch: { $max: '$createdAt' },
                    nearestExpiry: { $min: '$expiryDate' },
                    batches: {
                        $push: {
                            _id: '$_id',
                            batchNumber: '$batchNumber',
                            inventoryNo: '$inventoryNo',
                            totalInventory: '$totalInventory',
                            totalUnits: '$totalUnits',
                            packQuantity: '$packQuantity',
                            unitPrice: '$unitPrice',
                            salePrice: '$salePrice',
                            wholeSalePrice: '$wholeSalePrice',
                            expiryDate: '$expiryDate',
                            place: '$place',
                            placeNo: '$placeNo',
                            createdAt: '$createdAt'
                        }
                    }
                }
            },
            {
                $addFields: {
                    stockStatus: { $cond: [{ $gt: ['$totalStock', 0] }, 'active', 'zero'] },
                    hasExpiringSoon: {
                        $cond: {
                            if: {
                                $and: [
                                    { $ne: ['$nearestExpiry', null] },
                                    { $lte: ['$nearestExpiry', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] }
                                ]
                            },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $sort: {
                    [sortBy === 'productName' ? 'productName' :
                     sortBy === 'totalValue' ? 'totalValue' :
                     sortBy === 'batchCount' ? 'batchCount' :
                     sortBy === 'createdAt' ? 'newestBatch' : 'totalStock']: sortOrder
                }
            }
        ];

        // Count
        const countResult = await Inventory.aggregate([...pipeline, { $count: 'total' }]);
        totalCount = countResult[0]?.total || 0;

        // Paginate
        pipeline.push({ $skip: skip }, { $limit: pageSize });
        results = await Inventory.aggregate(pipeline);

        // Summary
        const summaryPipeline = [
            { $match: matchConditions },
            {
                $lookup: {
                    from: 'products',
                    localField: 'productRef',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
            ...(category ? [{ $match: { 'productDetails.categoryName': { $regex: category, $options: 'i' } } }] : []),
            ...(subcategory ? [{ $match: { 'productDetails.subcategory': { $regex: subcategory, $options: 'i' } } }] : []),
            ...(brand ? [{ $match: { 'productDetails.brand': { $regex: brand, $options: 'i' } } }] : []),
            {
                $group: {
                    _id: null,
                    totalProducts: { $addToSet: '$productRef' },
                    totalBatches: { $sum: 1 },
                    totalStock: { $sum: '$totalInventory' },
                    totalUnits: { $sum: '$totalUnits' },
                    totalValue: { $sum: '$totalPrice' },
                    activeBatches: { $sum: { $cond: [{ $gt: ['$totalInventory', 0] }, 1, 0] } },
                    zeroBatches: { $sum: { $cond: [{ $eq: ['$totalInventory', 0] }, 1, 0] } },
                    avgUnitPrice: { $avg: '$unitPrice' },
                    avgSalePrice: { $avg: '$salePrice' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalProducts: { $size: '$totalProducts' },
                    totalBatches: 1,
                    totalStock: 1,
                    totalUnits: 1,
                    totalValue: { $round: ['$totalValue', 2] },
                    activeBatches: 1,
                    zeroBatches: 1,
                    avgUnitPrice: { $round: ['$avgUnitPrice', 2] },
                    avgSalePrice: { $round: ['$avgSalePrice', 2] }
                }
            }
        ];

        const summaryResult = await Inventory.aggregate(summaryPipeline);
        summary = summaryResult[0] || {
            totalProducts: 0, totalBatches: 0, totalStock: 0,
            totalUnits: 0, totalValue: 0, activeBatches: 0, zeroBatches: 0
        };

    } else {
        // Individual batches (not grouped)
        const pipeline = [
            { $match: matchConditions },
            {
                $lookup: {
                    from: 'products',
                    localField: 'productRef',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
            ...(category ? [{ $match: { 'productDetails.categoryName': { $regex: category, $options: 'i' } } }] : []),
            ...(subcategory ? [{ $match: { 'productDetails.subcategory': { $regex: subcategory, $options: 'i' } } }] : []),
            ...(brand ? [{ $match: { 'productDetails.brand': { $regex: brand, $options: 'i' } } }] : []),
            { $sort: { [sortBy]: sortOrder } }
        ];

        const countResult = await Inventory.aggregate([...pipeline, { $count: 'total' }]);
        totalCount = countResult[0]?.total || 0;

        pipeline.push({ $skip: skip }, { $limit: pageSize });
        results = await Inventory.aggregate(pipeline);

        // Summary
        const summaryResult = await Inventory.aggregate([
            { $match: matchConditions },
            {
                $group: {
                    _id: null,
                    totalBatches: { $sum: 1 },
                    totalStock: { $sum: '$totalInventory' },
                    totalUnits: { $sum: '$totalUnits' },
                    totalValue: { $sum: '$totalPrice' },
                    activeBatches: { $sum: { $cond: [{ $gt: ['$totalInventory', 0] }, 1, 0] } },
                    zeroBatches: { $sum: { $cond: [{ $eq: ['$totalInventory', 0] }, 1, 0] } }
                }
            }
        ]);
        summary = summaryResult[0] || { totalBatches: 0, totalStock: 0, totalUnits: 0, totalValue: 0 };
    }

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
        type: 'inventory',
        data: results,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: totalCount,
            itemsPerPage: pageSize,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        summary,
        filters: { applied: query }
    };
};

/**
 * Dashboard Overview
 */
const getDashboardOverview = async (query) => {
    const overview = await Inventory.aggregate([
        {
            $facet: {
                overall: [
                    {
                        $group: {
                            _id: null,
                            totalBatches: { $sum: 1 },
                            totalStock: { $sum: '$totalInventory' },
                            totalUnits: { $sum: '$totalUnits' },
                            totalValue: { $sum: '$totalPrice' },
                            uniqueProducts: { $addToSet: '$productRef' }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            totalBatches: 1,
                            totalStock: 1,
                            totalUnits: 1,
                            totalValue: { $round: ['$totalValue', 2] },
                            uniqueProducts: { $size: '$uniqueProducts' }
                        }
                    }
                ],
                stockStatus: [
                    {
                        $group: {
                            _id: { $cond: [{ $gt: ['$totalInventory', 0] }, 'active', 'zero'] },
                            count: { $sum: 1 },
                            totalStock: { $sum: '$totalInventory' },
                            totalValue: { $sum: '$totalPrice' }
                        }
                    }
                ],
                expiringSoon: [
                    {
                        $match: {
                            expiryDate: {
                                $gte: new Date(),
                                $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                            },
                            totalInventory: { $gt: 0 }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            totalStock: { $sum: '$totalInventory' },
                            totalValue: { $sum: '$totalPrice' }
                        }
                    }
                ],
                expired: [
                    {
                        $match: {
                            expiryDate: { $lt: new Date() },
                            totalInventory: { $gt: 0 }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            totalStock: { $sum: '$totalInventory' },
                            totalValue: { $sum: '$totalPrice' }
                        }
                    }
                ],
                lowStock: [
                    {
                        $match: { totalInventory: { $gt: 0, $lte: 10 } }
                    },
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            products: { $addToSet: '$productRef' }
                        }
                    },
                    {
                        $project: { count: 1, uniqueProducts: { $size: '$products' } }
                    }
                ],
                recentActivity: [
                    {
                        $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
                    },
                    {
                        $group: {
                            _id: null,
                            newBatches: { $sum: 1 },
                            totalAdded: { $sum: '$totalInventory' }
                        }
                    }
                ],
                topProducts: [
                    {
                        $group: {
                            _id: '$productRef',
                            productName: { $first: '$productName' },
                            productId: { $first: '$productId' },
                            totalStock: { $sum: '$totalInventory' },
                            totalValue: { $sum: '$totalPrice' }
                        }
                    },
                    { $sort: { totalStock: -1 } },
                    { $limit: 5 }
                ],
                byLocation: [
                    { $match: { place: { $ne: '' } } },
                    {
                        $group: {
                            _id: '$place',
                            totalStock: { $sum: '$totalInventory' },
                            batchCount: { $sum: 1 }
                        }
                    },
                    { $sort: { totalStock: -1 } },
                    { $limit: 10 }
                ]
            }
        }
    ]);

    const data = overview[0];

    return {
        type: 'overview',
        data: {
            overall: data.overall[0] || { totalBatches: 0, totalStock: 0, totalUnits: 0, totalValue: 0, uniqueProducts: 0 },
            stockStatus: {
                active: data.stockStatus.find(s => s._id === 'active') || { count: 0, totalStock: 0, totalValue: 0 },
                zero: data.stockStatus.find(s => s._id === 'zero') || { count: 0, totalStock: 0, totalValue: 0 }
            },
            alerts: {
                expiringSoon: data.expiringSoon[0] || { count: 0, totalStock: 0, totalValue: 0 },
                expired: data.expired[0] || { count: 0, totalStock: 0, totalValue: 0 },
                lowStock: data.lowStock[0] || { count: 0, uniqueProducts: 0 }
            },
            recentActivity: data.recentActivity[0] || { newBatches: 0, totalAdded: 0 },
            topProducts: data.topProducts,
            byLocation: data.byLocation
        }
    };
};

/**
 * Category Analytics
 */
const getCategoryAnalytics = async (query, page, pageSize, skip, sortOrder) => {
    const { sortBy = 'totalStock' } = query;

    const pipeline = [
        {
            $lookup: {
                from: 'products',
                localField: 'productRef',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$product.categoryRef',
                categoryName: { $first: '$product.categoryName' },
                totalStock: { $sum: '$totalInventory' },
                totalUnits: { $sum: '$totalUnits' },
                totalValue: { $sum: '$totalPrice' },
                batchCount: { $sum: 1 },
                productCount: { $addToSet: '$productRef' },
                activeBatches: { $sum: { $cond: [{ $gt: ['$totalInventory', 0] }, 1, 0] } },
                zeroBatches: { $sum: { $cond: [{ $eq: ['$totalInventory', 0] }, 1, 0] } },
                avgUnitPrice: { $avg: '$unitPrice' },
                avgSalePrice: { $avg: '$salePrice' }
            }
        },
        { $addFields: { productCount: { $size: '$productCount' } } },
        { $sort: { [sortBy]: sortOrder } }
    ];

    const countResult = await Inventory.aggregate([...pipeline, { $count: 'total' }]);
    const totalCount = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip }, { $limit: pageSize });
    const results = await Inventory.aggregate(pipeline);

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
        type: 'category',
        data: results,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: totalCount,
            itemsPerPage: pageSize,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
};

/**
 * Expiry Analytics
 */
const getExpiryAnalytics = async (query, page, pageSize, skip, sortOrder) => {
    const { daysAhead = 90 } = query;
    const targetDate = new Date(Date.now() + parseInt(daysAhead) * 24 * 60 * 60 * 1000);

    const pipeline = [
        {
            $match: {
                totalInventory: { $gt: 0 },
                expiryDate: { $exists: true, $ne: null }
            }
        },
        {
            $addFields: {
                daysUntilExpiry: {
                    $divide: [{ $subtract: ['$expiryDate', new Date()] }, 1000 * 60 * 60 * 24]
                },
                expiryStatus: {
                    $cond: {
                        if: { $lt: ['$expiryDate', new Date()] },
                        then: 'expired',
                        else: {
                            $cond: {
                                if: { $lte: ['$expiryDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] },
                                then: 'critical',
                                else: {
                                    $cond: {
                                        if: { $lte: ['$expiryDate', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)] },
                                        then: 'warning',
                                        else: 'safe'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        { $match: { expiryDate: { $lte: targetDate } } },
        {
            $lookup: {
                from: 'products',
                localField: 'productRef',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $sort: { expiryDate: 1 } }
    ];

    const countResult = await Inventory.aggregate([...pipeline, { $count: 'total' }]);
    const totalCount = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip }, { $limit: pageSize });
    const results = await Inventory.aggregate(pipeline);

    // Summary by status
    const summaryPipeline = [
        {
            $match: {
                totalInventory: { $gt: 0 },
                expiryDate: { $exists: true, $ne: null }
            }
        },
        {
            $addFields: {
                expiryStatus: {
                    $cond: {
                        if: { $lt: ['$expiryDate', new Date()] },
                        then: 'expired',
                        else: {
                            $cond: {
                                if: { $lte: ['$expiryDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] },
                                then: 'critical',
                                else: {
                                    $cond: {
                                        if: { $lte: ['$expiryDate', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)] },
                                        then: 'warning',
                                        else: 'safe'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        {
            $group: {
                _id: '$expiryStatus',
                count: { $sum: 1 },
                totalStock: { $sum: '$totalInventory' },
                totalValue: { $sum: '$totalPrice' }
            }
        }
    ];

    const summaryResult = await Inventory.aggregate(summaryPipeline);
    const summary = {
        expired: summaryResult.find(s => s._id === 'expired') || { count: 0, totalStock: 0, totalValue: 0 },
        critical: summaryResult.find(s => s._id === 'critical') || { count: 0, totalStock: 0, totalValue: 0 },
        warning: summaryResult.find(s => s._id === 'warning') || { count: 0, totalStock: 0, totalValue: 0 },
        safe: summaryResult.find(s => s._id === 'safe') || { count: 0, totalStock: 0, totalValue: 0 }
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
        type: 'expiry',
        data: results,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: totalCount,
            itemsPerPage: pageSize,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        summary,
        filters: { daysAhead: parseInt(daysAhead) }
    };
};

/**
 * Location Analytics
 */
const getLocationAnalytics = async (query, page, pageSize, skip, sortOrder) => {
    const { place } = query;
    const matchCondition = place ? { place: { $regex: place, $options: 'i' } } : {};

    const pipeline = [
        { $match: { ...matchCondition, place: { $ne: '' } } },
        {
            $group: {
                _id: '$place',
                totalStock: { $sum: '$totalInventory' },
                totalUnits: { $sum: '$totalUnits' },
                totalValue: { $sum: '$totalPrice' },
                batchCount: { $sum: 1 },
                productCount: { $addToSet: '$productRef' },
                activeBatches: { $sum: { $cond: [{ $gt: ['$totalInventory', 0] }, 1, 0] } }
            }
        },
        { $addFields: { productCount: { $size: '$productCount' } } },
        { $sort: { totalStock: sortOrder } }
    ];

    const countResult = await Inventory.aggregate([...pipeline, { $count: 'total' }]);
    const totalCount = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip }, { $limit: pageSize });
    const results = await Inventory.aggregate(pipeline);

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
        type: 'location',
        data: results,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: totalCount,
            itemsPerPage: pageSize,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
};

/**
 * Trends Analytics
 */
const getTrendsAnalytics = async (query) => {
    const { period = 'monthly', startDate, endDate, trendLimit = 12 } = query;

    const matchCondition = {};
    if (startDate || endDate) {
        Object.assign(matchCondition, buildDateFilter(startDate, endDate, 'createdAt'));
    }

    let dateGroup;
    switch (period) {
        case 'daily':
            dateGroup = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };
            break;
        case 'weekly':
            dateGroup = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
            break;
        case 'yearly':
            dateGroup = { year: { $year: '$createdAt' } };
            break;
        default:
            dateGroup = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
    }

    const pipeline = [
        { $match: matchCondition },
        {
            $group: {
                _id: dateGroup,
                batchesAdded: { $sum: 1 },
                stockAdded: { $sum: '$totalInventory' },
                valueAdded: { $sum: '$totalPrice' },
                productsAdded: { $addToSet: '$productRef' },
                avgUnitPrice: { $avg: '$unitPrice' }
            }
        },
        { $addFields: { productsAdded: { $size: '$productsAdded' } } },
        { $sort: { '_id.year': -1, '_id.month': -1, '_id.week': -1, '_id.day': -1 } },
        { $limit: parseInt(trendLimit) }
    ];

    const trends = await Inventory.aggregate(pipeline);

    return {
        type: 'trends',
        data: trends.reverse(),
        period
    };
};

/**
 * Search Inventory
 */
const searchInventory = async (query, page, pageSize, skip) => {
    const { q, searchType = 'all' } = query;

    if (!q || q.length < 2) {
        return {
            type: 'search',
            data: [],
            pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: pageSize },
            query: q,
            error: 'Search query must be at least 2 characters'
        };
    }

    const searchRegex = { $regex: q, $options: 'i' };
    let matchCondition = {};

    if (searchType === 'product' || searchType === 'all') {
        matchCondition.$or = [
            { productName: searchRegex },
            { batchNumber: searchRegex }
        ];
    }
    if (searchType === 'batch') {
        matchCondition = { batchNumber: searchRegex };
    }

    const pipeline = [
        { $match: matchCondition },
        {
            $lookup: {
                from: 'products',
                localField: 'productRef',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        ...(searchType === 'category' ? [{
            $match: {
                $or: [
                    { 'product.categoryName': searchRegex },
                    { 'product.subcategory': searchRegex }
                ]
            }
        }] : []),
        {
            $project: {
                _id: 1,
                inventoryNo: 1,
                batchNumber: 1,
                productId: 1,
                productName: 1,
                totalInventory: 1,
                unitPrice: 1,
                salePrice: 1,
                expiryDate: 1,
                place: 1,
                'product.categoryName': 1,
                'product.subcategory': 1,
                'product.brand': 1
            }
        },
        { $sort: { totalInventory: -1 } }
    ];

    const countResult = await Inventory.aggregate([...pipeline, { $count: 'total' }]);
    const totalCount = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip }, { $limit: pageSize });
    const results = await Inventory.aggregate(pipeline);

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
        type: 'search',
        data: results,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: totalCount,
            itemsPerPage: pageSize,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        query: q,
        searchType
    };
};

/**
 * Single Product Analytics
 */
const getSingleProductAnalytics = async (query, page, pageSize, skip) => {
    const { productRef, productId } = query;

    const matchCondition = productRef
        ? { productRef: new mongoose.Types.ObjectId(productRef) }
        : { productId: parseInt(productId) };

    const pipeline = [
        { $match: matchCondition },
        {
            $facet: {
                summary: [
                    {
                        $group: {
                            _id: '$productRef',
                            productName: { $first: '$productName' },
                            productId: { $first: '$productId' },
                            totalStock: { $sum: '$totalInventory' },
                            totalUnits: { $sum: '$totalUnits' },
                            totalPacks: { $sum: '$packQuantity' },
                            totalValue: { $sum: '$totalPrice' },
                            batchCount: { $sum: 1 },
                            activeBatches: { $sum: { $cond: [{ $gt: ['$totalInventory', 0] }, 1, 0] } },
                            zeroBatches: { $sum: { $cond: [{ $eq: ['$totalInventory', 0] }, 1, 0] } },
                            avgUnitPrice: { $avg: '$unitPrice' },
                            avgSalePrice: { $avg: '$salePrice' },
                            minUnitPrice: { $min: '$unitPrice' },
                            maxUnitPrice: { $max: '$unitPrice' },
                            oldestBatch: { $min: '$createdAt' },
                            newestBatch: { $max: '$createdAt' },
                            nearestExpiry: { $min: { $cond: [{ $gte: ['$expiryDate', new Date()] }, '$expiryDate', null] } }
                        }
                    },
                    {
                        $lookup: {
                            from: 'products',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'productDetails'
                        }
                    },
                    { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } }
                ],
                batches: [
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: pageSize }
                ],
                batchCount: [{ $count: 'total' }],
                monthlyTrend: [
                    {
                        $group: {
                            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                            batchesAdded: { $sum: 1 },
                            stockAdded: { $sum: '$totalInventory' },
                            valueAdded: { $sum: '$totalPrice' }
                        }
                    },
                    { $sort: { '_id.year': -1, '_id.month': -1 } },
                    { $limit: 12 }
                ],
                locationDistribution: [
                    { $match: { totalInventory: { $gt: 0 } } },
                    {
                        $group: {
                            _id: '$place',
                            stock: { $sum: '$totalInventory' },
                            batches: { $sum: 1 }
                        }
                    }
                ]
            }
        }
    ];

    const result = await Inventory.aggregate(pipeline);
    const data = result[0];

    if (!data.summary[0]) {
        return {
            type: 'product',
            data: null,
            error: 'Product not found'
        };
    }

    const totalBatches = data.batchCount[0]?.total || 0;
    const totalPages = Math.ceil(totalBatches / pageSize);

    return {
        type: 'product',
        data: {
            summary: data.summary[0],
            batches: data.batches,
            analytics: {
                monthlyTrend: data.monthlyTrend,
                locationDistribution: data.locationDistribution
            }
        },
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: totalBatches,
            itemsPerPage: pageSize,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
};

module.exports = {
    stockOverview
};