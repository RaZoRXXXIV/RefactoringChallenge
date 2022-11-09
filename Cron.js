// The code snippet below is functional, but is made ugly on purpose
// Please refactor it to a state you'd be satisfied with and send back the refactored code

// Bonus challenge: there is a simple change that will improve database writes drastically
// Can you spot it? A: updateMany is faster than updateOne except that it comes at the risk of updating more than intended if not given proper criteria

const startCronJob = require("nugttah-backend/helpers/start.cron.job");
const { createInvoices } = require("./Invoices");

startCronJob("*/1 * * * *", createInvoices, true); // at 00:00 every day
