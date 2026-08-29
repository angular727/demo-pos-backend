
const users = require('../src/users/userRouter');
const path = require('path');
const productRouter = require("../src/product/productRouter");
const stockRouter = require("../src/stock/stockRouter");
const saleRouter = require("../src/sale/saleRouter");
const sideUserRouter = require("../src/sideUser/sideUserRouter");
const customerRouter = require("../src/customer/customerRouter");
const supplierRouter = require("../src/supplier/supplierRouter");

const customerTypeRouter = require("../src/cutomerTypes/customerTypeRouter");
const unitRouter = require("../src/unit/unitRouter");
const categoryRouter = require("../src/category/categoryRouter");
const transactionRouter = require("../src/transaction/transactionRouter");

const purchaseReturnRouter = require("../src/purchaseReturn/purchaseReturnRouter");

const returnProductRouter = require("../src/sale/saleReturnRouter");
const preOrderRouter = require("../src/preOrder/PreOrderRouter");
const shippingRouter = require("../src/shipping/shippingRouter");

const customerLedgerRouter = require("../src/customer/customerLedgerRouter");

const supplierLedgerRouter = require("../src/supplier/supplierLedgerRouter");
const countRouter = require("../src/totalCounts/totalCountRouter");
const sampleRouter = require("../src/sample/sampleRouter");
const paymentAccountRouter = require("../src/paymentAccount/paymentAccountRouter");
const manufactoringRouter = require("../src/manufactoring/manufactoringRouter");
const taskRouter = require("../src/tasks/taskRouter");
const purchaseRouter = require("../src/purchaseInvoice/purchaseRouter");
const customerReportsRouter = require("../src/reports/customerReportsRouter");
const saleReportsRouter = require("../src/reports/saleReportRouter");
const caseRouter = require('../src/cases/caseRouter');
const placeRouter = require('../src/place/placeRouter');
const bankRouter = require('../src/banks/bankRouter');
const expenseCategoryRouter = require('../src/expenseCategory/expenseCategoryRouter');
const expenseRouter = require('../src/expense/expenseRouter');const productRateRouter = require('../src/productRates/productRateRouter');
const OnlineSaleRouter = require('../src/online-order/onlineOrderRouter');

const {apiStart} = require('../src/shared/apiStart');
const expenseReportRouter = require('../src/reports/expenseReportRouter');
const whatsappRouter = require('../src/whatsapp_/whatsappRouter');

const employeeRouter = require('../src/employees/employeesRouter');
const attendanceRouter = require('../src/attendance/employeesRouter');
const purchaseRecordRouter = require('../src/purchase-record/purchaseRecordRouter');
const inventoryRouter = require('../src/inventory/invenoryRouter');
const inventoryTotalsRouter = require('../src/inventory/inventoyTotalsRouter');
const quotationRouter = require('../src/quotation/quotationRouter');
const saleTotalRouter = require("../src/sale/saleTotalRouter");
const salesmanRouter = require("../src/salesman/salesmanRouter");
const customerKhataRouter = require("../src/customerKhata/khataRouter");
const stockAdjustmentReportRouter = require('../src/reports/stockAdjustmentReportRouter');
const dayByDayProductReportRouter = require('../src/reports/dayByDayProductReportRouter');

const universalReportRouter = require('../src/reports/universalReportRouter');
const salePurchaseReport = require('../src/reports/purchase-sale-reportRouter');
const stockSummaryRouter = require('../src/reports/stockSummaryRouter');
module.exports = (app) => {
  // app.use('/generic',  genericRouter);
 
app.use(apiStart+'/users', users);
console.log("apiStart+'/users' ", apiStart+'/users')
app.use(apiStart+'/product', productRouter);

app.use(apiStart+'/employees', employeeRouter);
app.use(apiStart+'/attendance', attendanceRouter);
app.use(apiStart+'/invoicerecord', purchaseRecordRouter);
app.use(apiStart+'/inventory', inventoryRouter);
app.use(apiStart+'/inventory-total', inventoryTotalsRouter);
app.use(apiStart+'/salereport', saleReportsRouter);
app.use(apiStart+'/sale-total', saleTotalRouter);
app.use(apiStart+'/expensereport', expenseReportRouter);
app.use(apiStart+'/expensecategory', expenseCategoryRouter);
app.use(apiStart+'/expense', expenseRouter);

app.use(apiStart+'/place', placeRouter);
app.use(apiStart+'/bank', bankRouter);
app.use(apiStart+'/rate', productRateRouter);
app.use(apiStart+'/whatsapp', whatsappRouter);
app.use(apiStart+'/stock', stockRouter);
app.use(apiStart+'/sale', saleRouter);
app.use(apiStart+'/quotation', quotationRouter);
app.use(apiStart+'/purchase', purchaseRouter);
app.use(apiStart+'/preorder', preOrderRouter);
app.use(apiStart+'/supplier', supplierRouter);
app.use(apiStart+'/category', categoryRouter);
app.use(apiStart+'/shipping', shippingRouter);
app.use(apiStart+'/reports', customerReportsRouter);
app.use(apiStart+'/manufactoring', manufactoringRouter);
app.use(apiStart+'/customerType', customerTypeRouter);
app.use(apiStart+'/task', taskRouter);
app.use(apiStart+'/sample', sampleRouter);
app.use(apiStart+'/paymentaccount', paymentAccountRouter);
app.use(apiStart+'/unit', unitRouter);
app.use(apiStart+'/case', caseRouter);
app.use(apiStart+"/onlineorder",OnlineSaleRouter)
app.use(apiStart+"/customer",customerRouter)
app.use(apiStart+"/customerledger",customerLedgerRouter)
app.use(apiStart+"/supplierledger",supplierLedgerRouter)
app.use(apiStart+"/count",countRouter)
app.use(apiStart+"/transaction",transactionRouter)
app.use(apiStart+"/salereturn",returnProductRouter)
app.use(apiStart+"/purchaseReturn",purchaseReturnRouter)
app.use(apiStart+"/sideusers",sideUserRouter)
app.use(apiStart +'/stock-summary', stockSummaryRouter);
app.use(apiStart + '/salesman', salesmanRouter);
app.use(apiStart + "/customer-khata", customerKhataRouter);
app.use(apiStart+"/day-by-day-product-report", dayByDayProductReportRouter);

app.use(apiStart + '/stock-adjustment-report', stockAdjustmentReportRouter);
app.use(apiStart+"/sale-purchase-report",salePurchaseReport);
app.use(apiStart+"/universal-report",universalReportRouter);
  // app.use('/users', validateAuth.checkIfAuthenticated, getData.getGeoip, users);
  // Unmatched route -> JSON 404
  // (pehle yahan subdomain ke hisaab se Angular index.html serve hoti thi,
  //  ab frontend alag deploy hota hai)
  app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'API route not found: ' + req.originalUrl });
  });
};
