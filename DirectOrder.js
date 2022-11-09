const DirectOrder = require("nugttah-backend/modules/direct.orders");
const DirectOrderPart = require("nugttah-backend/modules/direct.order.parts");

async function getDirectOrder(directOrderId) {
  const directOrder = await DirectOrder.Model.findOne({
    _id: directOrderId,
  }).select(
    "partsIds requestPartsIds discountAmount deliveryFees walletPaymentAmount"
  );

  return directOrder;
}

async function updateDirectOrderModel(
  allDirectOrderParts,
  directPartsIds,
  invoiceId
) {
  await DirectOrder.Model.updateMany(
    { _id: getDirectOrder(allDirectOrderParts[0].directOrderId)._id },
    { $addToSet: { invoicesIds: invoiceId } }
  );
  for (const directPartId of directPartsIds) {
    await DirectOrderPart.Model.updateMany(
      { _id: directPartId },
      { invoiceId }
    );
  }
}

function getDirectOrderPartsIds(allDirectOrderParts) {
  const directOrderParts = allDirectOrderParts.filter(
    (directOrderPart) =>
      directOrderPart.partClass === "StockPart" ||
      directOrderPart.partClass === "QuotaPart"
  );

  return directOrderParts.map((part) => part._id);
}
function getRequestPartsIds(allDirectOrderParts) {
  const requestParts = allDirectOrderParts.filter(
    (part) => part.partClass === "requestPart"
  );

  return requestParts.map((part) => part._id);
}

exports.modules = {
  getDirectOrder,
  updateDirectOrderModel,
  getDirectOrderPartsIds,
  getRequestPartsIds,
};
