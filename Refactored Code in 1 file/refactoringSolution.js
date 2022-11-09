// The code snippet below is functional, but is made ugly on purpose
// Please refactor it to a state you'd be satisfied with and send back the refactored code

// Bonus challenge: there is a simple change that will improve database writes drastically
// Can you spot it? A: updateMany is faster than updateOne except that it comes at the risk of updating more than intended if not given proper criteria

const startCronJob = require("nugttah-backend/helpers/start.cron.job");
const Helpers = require("nugttah-backend/helpers");
const Invoice = require("nugttah-backend/modules/invoices");
const DirectOrder = require("nugttah-backend/modules/direct.orders");
const Part = require("nugttah-backend/modules/parts");
const DirectOrderPart = require("nugttah-backend/modules/direct.order.parts");

function createInvoices() {
  try {
    const invoices = initInvoices();

    return {
      case: 1,
      message: "invoices created successfully.",
      invoicesIds: invoices,
    };
  } catch (err) {
    Helpers.reportError(err);
  }
}

function initInvoices() {
  const directOrderPartsGroups = Helpers.groupBy(allParts, "directOrderId");
  const allParts = getAllParts();
  const invoices = [];
  for (const allDirectOrderParts of directOrderPartsGroups) {
    const directOrderParts = allDirectOrderParts.filter(
      (directOrderPart) =>
        directOrderPart.partClass === "StockPart" ||
        directOrderPart.partClass === "QuotaPart"
    );
    const requestParts = allDirectOrderParts.filter(
      (part) => part.partClass === "requestPart"
    );

    const directPartsIds = directOrderParts.map((part) => part._id);
    const requestPartsIds = requestParts.map((part) => part._id);

    const invoiceId = getInvoiceId(
      createInvoice(
        getDirectOrder(allDirectOrderParts[0].directOrderId),
        directPartsIds,
        requestPartsIds
      )
    );

    updateDirectOrderModel(allDirectOrderParts, directPartsIds, invoiceId);

    // wait for updates before pushing to invoices array
    updatePartModel(requestPartsIds, invoiceId);

    invoices.push(invoiceId);
  }

  return invoices;
}

function getInvoiceId(invoice) {
  return invoice._id;
}

async function createInvoice(
  directOrder,
  directOrderParts,
  requestParts,
  directPartsIds,
  requestPartsIds
) {
  const totalPrice = calculateTotalPrice(directOrderParts, requestParts);

  let {
    walletPaymentAmount,
    discountAmount,
    deliveryFees,
    _id: directOrderId,
  } = directOrder;

  let totalAmount = await calculateNetTotalAmount(
    walletPaymentAmount,
    discountAmount,
    deliveryFees,
    directOrderId,
    totalPrice
  );

  const invoice = await Invoice.Model.create({
    directOrderId,
    directOrderPartsIds: directPartsIds,
    requestPartsIds: requestPartsIds,
    totalPartsAmount: totalPrice,
    totalAmount,
    deliveryFees,
    walletPaymentAmount,
    discountAmount,
  });
  return invoice;
}

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

async function calculateNetTotalAmount(
  walletPaymentAmount,
  discountAmount,
  deliveryFees,
  directOrderId,
  TotalPrice
) {
  const invoices = await Invoice.Model.find({
    directOrderId: directOrderId,
  }).select("walletPaymentAmount discountAmount deliveryFees");

  let totalAmount = TotalPrice;

  if (deliveryFees && invoices.length === 0) totalAmount += deliveryFees;

  if (walletPaymentAmount) {
    invoices.forEach((invoice) => {
      walletPaymentAmount = Math.min(
        0,
        walletPaymentAmount - invoice.walletPaymentAmount
      );
    });
    walletPaymentAmount = Math.min(walletPaymentAmount, totalAmount);
    totalAmount -= walletPaymentAmount;
  }
  if (discountAmount) {
    invoces.forEach((invoice) => {
      discountAmount = Math.min(0, discountAmount - invoice.discountAmount);
    });
    discountAmount = Math.min(discountAmount, totalAmount);
    totalAmount -= discountAmount;
  }

  if (totalAmount < 0) {
    throw Error(
      `Could not create invoice for directOrder: ${directOrderId} with totalAmount: ${totalAmount}. `
    );
  }
  return totalAmount;
}

function calculateTotalPrice(directOrderParts, requestParts) {
  const dpsprice = directOrderParts.reduce(
    (sum, part) => sum + part.priceBeforeDiscount,
    0
  );
  const rpsprice = requestParts.reduce(
    (sum, part) => sum + part.premiumPriceBeforeDiscount,
    0
  );

  return Helpers.Numbers.toFixedNumber(rpsprice + dpsprice);
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

startCronJob("*/1 * * * *", createInvoices, true); // at 00:00 every day

module.exports = createInvoices;
