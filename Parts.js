const Part = require("nugttah-backend/modules/parts");
const DirectOrderPart = require("nugttah-backend/modules/direct.order.parts");

async function updatePartModel(requestPartsIds, invoiceId) {
  await requestPartsIds.map((requestPartId) => {
    return new Promise((resolve, reject) => {
      Part.Model.updateMany({ _id: requestPartId }, { invoiceId })
        .then((result) => {
          return resolve();
        })
        .catch(() => {
          reject();
        });
    });
  });
}

async function getAllParts() {
  const dps = await DirectOrderPart.Model.find({
    createdAt: { $gt: new Date("2021-04-01") },
    fulfillmentCompletedAt: { $exists: true },
    invoiceId: { $exists: false },
  }).select("_id directOrderId partClass priceBeforeDiscount");

  const all_ps = await Part.Model.find({
    directOrderId: { $exists: true },
    createdAt: { $gt: new Date("2021-04-01") },
    partClass: "requestPart",
    pricedAt: { $exists: true },
    invoiceId: { $exists: false },
  }).select("_id directOrderId partClass premiumPriceBeforeDiscount");

  return all_ps.concat(dps);
}

exports.module = { updatePartModel, getAllParts };
