require('dotenv').config();
const { User } = require('../server/models');

(async () => {
  const users = await User.findAll({
    where: { subscriptionStatus: 'active' },
    attributes: ['id', 'email', 'firstName', 'lastName', 'subscriptionStatus', 'subscriptionEndDate', 'stripeCustomerId']
  });
  console.log('Total active users:', users.length);
  const now = new Date();
  let expiredCount = 0;
  users.forEach(u => {
    const end = u.subscriptionEndDate ? new Date(u.subscriptionEndDate) : null;
    const isPast = end ? end < now : false;
    if (isPast) expiredCount++;
    console.log(`${u.email} | End: ${u.subscriptionEndDate} | Expired? ${isPast} | Cust: ${u.stripeCustomerId}`);
  });
  console.log(`Summary: ${expiredCount} expired out of ${users.length}`);
  process.exit(0);
})();
