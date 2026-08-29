class BatchDetail {
    constructor(data = {}) {
       
        this.productRef = '';
        this.productId = '';
        this.productName = '';
        this.totalInventory = 0;
        this.crossSign = false;
        this.description = '';
        this.limit = '';
        this.purchasePrice = 0;
      this.batchNumber = ''; 
        this.purchaseReturn = false;
        this.discount = '';
        this.batchNumber = '';
        this.totalPrice = '';
        this.expiryDate = new Date();
        this.placeNo = '';
        this.place = '';
        this.piecePerCase = 0;
        this.unitPrice = 0;
        this.wholeSalePrice = '';
        this.location = [];
        this.salePrice = '';
        this.priceAfterDeliveryCharges = 0;


        // Override default values with provided data
        Object.assign(this, data);
    }
}

class BatchDetails {
    constructor(details = []) {
        this.batchDetails = details.map(detail => new BatchDetail(detail));
    }

    addBatch(detail) {
        this.batchDetails.push(new BatchDetail(detail));
    }

    getBatches() {
        return this.batchDetails;
    }

    updateBatch(index, detail) {
        if (index >= 0 && index < this.batchDetails.length) {
            this.batchDetails[index] = new BatchDetail({ 
                ...this.batchDetails[index], 
                ...detail 
            });
        }
    }

    removeBatch(index) {
        if (index >= 0 && index < this.batchDetails.length) {
            this.batchDetails.splice(index, 1);
        }
    }
}


module.exports = BatchDetail;