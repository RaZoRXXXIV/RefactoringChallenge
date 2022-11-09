const Invoice = require("nugttah-backend/modules/invoices");
const Helpers = require("nugttah-backend/helpers");
const { getDirectOrder, updateDirectOrderModel } = require("./DirectOrder");
const {
  updatePartModel,
  getAllParts,
  getDirectOrderPartsIds,
  getRequestPartsIds,
} = require("./Parts");

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
    const directPartsIds = getDirectOrderPartsIds(allDirectOrderParts);
    const requestPartsIds = getRequestPartsIds(allDirectOrderParts);

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

module.exports = { createInvoices };
