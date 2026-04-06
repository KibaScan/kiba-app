module.exports = {
  configure: jest.fn(),
  getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
  getOfferings: jest.fn(() => Promise.resolve({ current: null })),
  purchasePackage: jest.fn(() => Promise.resolve({})),
};
