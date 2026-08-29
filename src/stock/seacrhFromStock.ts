const Stock = require("./stockModel");
async function searchStocks(productName = '', categoryName='') {
    const stocks = await Stock.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'productRef',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.categoryRef',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: '$category'
      },
      {
        $match: {
          $or: [
            { 'product.name': { $regex: productName, $options: 'i' } },
            { 'category.name': { $regex: categoryName, $options: 'i' } }
          ]
        }
      },
      {
        $project: {
          _id: 1,
          stockNo: 1,
          productName: '$product.name',
          brand: '$product.brand',
          categoryName: '$category.name'
        }
      }
    ]);
  
    return stocks;
  }