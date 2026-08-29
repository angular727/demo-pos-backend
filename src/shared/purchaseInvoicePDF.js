const STORE_NAME = process.env.STORE_NAME || "Demo POS Store";
const STORE_TAGLINE = process.env.STORE_TAGLINE || "Quality You Can Trust";
const fs = require('fs')

const PDFDocument = require("pdfkit");
var path = require("path");
function createPurchaseInvoice(invoice, directory, callback) {
  let doc = new PDFDocument({ size: "A4", margins: { top: 10, left: 50, right:50, bottom: 0 } });
 // beforeHeader(doc,invoice)
 
  generateHeader(doc);
  
  generateCustomerInformation(doc, invoice);
  generateFooter(doc,invoice);
  generateInvoiceTable(doc, invoice);
 //var writeStream = fs.createWriteStream(path.join(__dirname,directory))
 //var writeStream = fs.createWriteStream(path.join(__dirname,directory))
 doc.end();
 // doc.pipe(writeStream);
 //writeStream.on('close', function () {
  // callback(path.join(__dirname,directory))
callback( doc)
 //});

}
const pageWidth =595.28 -50;
const pageHeight = 841.89-50;

// function beforeHeader(doc,invoice){
//     doc
//       .font('Helvetica')
//       .fontSize(18)
//       .text('Lab# '+ invoice.labNo, 430, 20);
// }
function generateHeader(doc) {
    doc.fontSize(20)
    var heading = doc.widthOfString(STORE_NAME);
    doc.fontSize(10)
    var subHeading = doc.widthOfString(STORE_TAGLINE);
  doc
    // .image(path.join(__dirname, '../assets/images/Alfalah.png'), 50, 45, { width: 50 })
    .fillColor("#000000")
    .fontSize(20)
    .text(STORE_NAME, (pageWidth/2)-(heading/2), 57)
    
    .fontSize(10)
    .text(STORE_TAGLINE,(pageWidth/2)-(subHeading/2), 57+20)

    .moveDown();
}

function generateCustomerInformation(doc, invoice) {
let headingsFontSize = 10;

//   let date =  new Date(invoice.createdAt).toISOString().split('T')[0];;
//   let split =date.split('/')
//   date = split[1]+'/'+ split[0]+'/'+ split[2]
// Step 1: Parse the timestamp string into a Date object
const dateObj = new Date(invoice.createdAt);

// Step 2: Extract year, month, and day
const year = dateObj.getFullYear();
const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed, so we add 1
const day = String(dateObj.getDate()).padStart(2, '0');

// Step 3: Format them into a string in "YYYY-MM-DD" format
const simpleDate = `${year}-${month}-${day}`;
    doc.fontSize(headingsFontSize)
    .font('Helvetica-Bold')
 
 
  
 
var arrayOfFirstTextColumn = ['Purchase invoice # ','Company Name: ','Phone: '];
var arrayOfSecondTextColumn = ['Date: ','Adress: ',];
var valueOfFirstTextColumn = [invoice?.invoiceNo, invoice?.supplierRef.name,  invoice?.supplierRef.phone];
var valueOfSecondTextColumn = [simpleDate, invoice?.supplierRef?.address];





var objectOfHeadingOne={
        heading1 : doc.widthOfString(arrayOfFirstTextColumn[0]),
         heading2 : doc.widthOfString(arrayOfFirstTextColumn[1]),
         heading3 : doc.widthOfString(arrayOfFirstTextColumn[2]),
        //  heading4 : doc.widthOfString(arrayOfFirstTextColumn[3]),
         
        
    }
   let objectOfHeadingTwo={
    heading1 : doc.widthOfString(arrayOfSecondTextColumn[0]),
    heading2 : doc.widthOfString(arrayOfSecondTextColumn[1]),
    // heading3 : doc.widthOfString(arrayOfSecondTextColumn[2]),
    // heading4 : doc.widthOfString(arrayOfSecondTextColumn[3]),
   
   }
   
   var valuesMaxWidth =0;
   var headingMaxWidth =objectOfHeadingTwo.heading2;
 
//get values max width
for(var ele of valueOfSecondTextColumn){

  if (ele && doc.widthOfString(ele)>valuesMaxWidth){
    valuesMaxWidth =doc.widthOfString(ele);

  }
}  

    doc.fontSize(8)


var fontSize=headingsFontSize;
var y=100;

    for(let i =0; i<arrayOfFirstTextColumn.length ; i++){
     
       
          doc
          .font('Helvetica-Bold')
          .fontSize(fontSize)
          .text(arrayOfFirstTextColumn[i], 50, y=y+fontSize+5)
          .font('Helvetica')
          .text(valueOfFirstTextColumn[i], objectOfHeadingOne["heading"+(i+1)] +(50+5), y)
        
    }
    y=100;
    let columnTwoX = valuesMaxWidth+headingMaxWidth+5;
 
    for(var i =0; i<arrayOfSecondTextColumn.length ; i++){
       
      doc
      .font('Helvetica-Bold')
      .fontSize(fontSize)
      .text(arrayOfSecondTextColumn[i], pageWidth -columnTwoX , y=y+fontSize+5)
      .font('Helvetica')
      .text(valueOfSecondTextColumn[i], objectOfHeadingTwo["heading"+(i+1)] +(pageWidth-columnTwoX)+5, y)
  }




}


function headingForTble(doc,invoiceTableTop){
  doc.font("Helvetica-Bold");
  generateTableRow(
    doc,
    invoiceTableTop,
   
    "Name",
    "description",
    "quantity",
    "price",
    "discount",
    "Total Price"

  );
  generateHr(doc, invoiceTableTop + 20);
  doc.font("Helvetica");
}

function generateInvoiceTable(doc, invoice) {
  let i;
  let invoiceTableTop = 250;
  let adjustTotals = 250;
  headingForTble(doc,invoiceTableTop)
let count=0;
let perPageProdcuct=11;

  for (i = 0; i < invoice.itemDetails?.length; i++) {
    
    if(i%perPageProdcuct==0 && i>1){
      count = 0;
      invoiceTableTop = 250;
      perPageProdcuct = 11
      doc.addPage();
      
      generateHeader(doc);

      generateCustomerInformation(doc, invoice);
    
       headingForTble(doc,invoiceTableTop)
      generateFooter(doc,invoice);
      doc.font("Helvetica");
    }
   
    const item = invoice.itemDetails[i];

    let position = invoiceTableTop + (count + 1) * 30;
 
    generateTableRow(
      doc,
      position,
      // item.item,
      item.productRef?.name,
      item?.description ? item.description  : ' ',
    item?.totalUnits || 0,
      item?.unitPrice || 0,
      item?.discount? item?.discount : 0,
   
      item?.totalPrice || 0
    );
    if(item.crossSign && item.topLeft || item.topRight || item.bottomLeft || item.bottomRight){
      // Set up the initial position for drawing the table
      // let initialX = 50;
      // let initialY = 50;

      // // Set up the column widths
      // const columnWidths = [200, 100];
      // // for(let a =0; a<4; a++){
      // const yPosition  = position +20;
      // const xPosition = initialX + columnWidths[0] + (1 * 15);
      //         const cellX = xPosition + (1 * 15) + 5;
      //         const cellY = yPosition + 5;
      // doc.text(item.topLeft || 222, initialX, yPosition);
      // doc.moveTo(cellX - 5, cellY).lineTo(cellX + 5, cellY).stroke();
      // doc.moveTo(cellX, cellY - 5).lineTo(cellX, cellY + 5).stroke();
      // Draw plus sign in each cell for user input
      // for (let i = 0; i < 4; i++) {
      //     for (let j = 0; j < 4; j++) {
      //         const xPosition = initialX + columnWidths[0] + (j * 15);
      //         const cellX = xPosition + (i * 15) + 5;
      //         const cellY = yPosition + 5;
      //         doc.moveTo(cellX - 5, cellY).lineTo(cellX + 5, cellY).stroke();
      //         doc.moveTo(cellX, cellY - 5).lineTo(cellX, cellY + 5).stroke();
      //     }
      // }
    // }

    
    
      position = position + 35;
      let cellXY = position -20
      const cellX = 200;
        const cellY = cellXY +20;
              let topLeft = item.topLeft || '';
              let topRight = item.topRight || '';
              let bottomLeft = item.bottomLeft || '';
              let bottomRight = item.bottomRight || '';
      doc.moveTo(cellX - 30, cellY).lineTo(cellX + 30, cellY).stroke();
      doc.moveTo(cellX, cellY - 20).lineTo(cellX, cellY + 20).stroke();
      doc.text(topLeft, cellX - doc.widthOfString(topLeft?.toString()) -5, cellY - 15); 
      doc.text(topRight, cellX+5 , cellY - 15);
      doc.text(bottomLeft, cellX -doc.widthOfString(bottomLeft?.toString()) -5, cellY +5 );
      doc.text(bottomRight , cellX+5 , cellY +5);
      // .rect(50, position+15, 150, 20)
      // .stroke('black', '#000')
      // .fill('black').stroke()
      count+=1;
      perPageProdcuct=perPageProdcuct -2;
      // generateTableRow(
      //   doc,
      //   position,
      //   '',
      //   item.topLeft || item.topRight || item.bottomLeft || item.bottomRight,
       
      //   "",
      //   "",
      //   ''
      // );
    }
  
   

    generateHr(doc, position + 20);
    count++
    adjustTotals = position+20;
}

  const subtotalPosition =  adjustTotals+ 20;
  generateTableRow(
    doc,
    subtotalPosition,
    "",
    "",
    "",
    "",
    "SubTotal",
    'Rs.'+invoice.subTotal
  );
  let paidToDatePosition = subtotalPosition + 20;
if(invoice?.totalDiscount){
  
  generateTableRow(
    doc,
    paidToDatePosition,
    "",
    "",
   "",
    "",
    "Total Discount",
    'Rs.'+invoice.totalDiscount 
  );
}else{
  paidToDatePosition = subtotalPosition;
}

let deliveryPostition = paidToDatePosition + 25;
if(invoice?.deliveryCharges){
    
  generateTableRow(
    doc,
    deliveryPostition,
    "",
    "",
   "",
    "",
    "Delivery Charges",
    invoice.deliveryCharges?  'Rs.'+ invoice.deliveryCharges : 'Rs.0'
  
  );
}else{
  deliveryPostition = paidToDatePosition;
}
let  previousePayablePostition = deliveryPostition ;
if(invoice?.previousePayable){
  previousePayablePostition= previousePayablePostition + 25;
generateTableRow(
  doc,
  previousePayablePostition,
  "",
  "",
  "",
  "",
  "Previouse Payable",
  'Rs.'+invoice.previousePayable || ''

);
}

  const payablePostition = previousePayablePostition + 25;
  generateTableRow(
    doc,
    payablePostition,
    "",
    "",
    "",
    "",
    "Payable Amount",
    'Rs.'+invoice.totalAfterDiscount || ''

  );

  const duePosition = payablePostition + 25;
  // doc.font("Helvetica");
  generateTableRow(
    doc,
    duePosition,
    "",
    "",
   "",
    "",
    "Received Ammount",
    invoice.paidAmount?  'Rs.'+ invoice.paidAmount : 'Rs.0'

  );
  doc.font("Helvetica");

   let  remainigAmmountPosition = duePosition ;

  if(invoice?.remainingAmount){
    remainigAmmountPosition= remainigAmmountPosition + 25;
  generateTableRow(
    doc,
    remainigAmmountPosition,
    "",
    "",
    "",
    "",
    "Remaining Ammount",
    'Rs.'+invoice.remainingAmount || ''
  
  );
  }

  // const reaminigPos = duePosition + 30;
  // doc.font("Helvetica-Bold");
  // generateTableRow(
  //   doc,
  //   reaminigPos,
  //   "",
  //   "",
  //   "Received Ammount",
  //   "",
  //   invoice.totalPrice
  // );
  // doc.font("Helvetica");

}

function generateFooter(doc,invoice) {
  doc
 
  // .rect(50, pageHeight-35, 500, 40)
  // .stroke('black', '#000')
  //.fill('black').stroke()
    .fontSize(10)
    .text(
      "Electronically Verified Invoice, No Signature(s) Required.",
      50,
      pageHeight-42,
      { align: "center", width: 500 }  )
      generateHr(doc,  pageHeight-30);
    doc
    // .font("Helvetica-Bold")
    // .text(invoice.invoiceBy, 50,
    //   pageHeight- 25,{ align: "right", })

    // .font("Helvetica")
    //   .text("Registered By", 50,
    //   pageHeight-12,{ align: "right" })
      // .font("Helvetica-Bold")
      // .text('Note: ',60,
      // pageHeight-30)
      // .font("Helvetica")
      // .lineGap(3)
      // .text("Lab test values should be interpreted by a physician in the context of clinical picture.This document is NEVER Challengeable at any PLACE/COURT and in any CONDITION", 90,
      // pageHeight-30, )
      .font("Helvetica-Bold")
      .text("Khanpur Road, Rahim Yar Khan Tel: +92 3006733378", 50,
      pageHeight+10, { align: "center" })
}

function generateTableRow(
  doc,
  y,
  name,
  description,
  quantity,
  price,
  discount,

  total,
  lineTotal
) {
  doc
    .fontSize(10)
    .text(name, 50, y,{  align: "left" })
    .text(description, 180, y, { width: 100, align: "left" })
    .text(quantity, 280, y,{  align: "left" })
    .text(price, 330, y, { width: 50, align: "left" })
    .text(discount, 390, y, { width: 100, align: "left" })
   
    .text(total, 450, y, { width: 100, align: "right" })
    .text(lineTotal, 150, y, { align: "right" });
}

function generateHr(doc, y) {
  doc
    .strokeColor("#000000")
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
}

function formatCurrency(cents) {
  return "$" + (cents / 100).toFixed(2);
}

function formatDate(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return year + "/" + month + "/" + day;
}

module.exports = {
  createPurchaseInvoice
};