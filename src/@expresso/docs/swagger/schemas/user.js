module.exports = {
  User: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      fullname: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      password: { type: 'string' },
      tokenVerify: { type: 'string' },
      isActive: { type: 'boolean' },
      isBlocked: { type: 'boolean' },
      RoleId: { type: 'string' },
      balance: { type: 'integer' },
    },
  },
}
