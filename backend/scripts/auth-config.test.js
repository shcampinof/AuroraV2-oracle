const assert = require('assert/strict');

const authServicePath = require.resolve('../services/authService');

function withEnv(env, fn) {
  const previous = { ...process.env };
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, env);
  delete require.cache[authServicePath];

  try {
    return fn(require('../services/authService'));
  } finally {
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
    Object.assign(process.env, previous);
    delete require.cache[authServicePath];
  }
}

withEnv({ NODE_ENV: 'production' }, ({ isLocalAdminEnabled }) => {
  assert.equal(isLocalAdminEnabled(), false, 'local admin must be disabled by default in production');
});

withEnv(
  {
    NODE_ENV: 'production',
    AUTH_LOCAL_ADMIN_ENABLED: 'true',
    AUTH_LOCAL_ADMIN_USERNAME: 'admin',
    AUTH_LOCAL_ADMIN_PASSWORD: 'admin',
  },
  ({ authenticateLocal }) => {
    assert.throws(
      () => authenticateLocal('admin', 'admin'),
      /credenciales por defecto/,
      'production must reject admin/admin'
    );
  }
);

withEnv(
  {
    NODE_ENV: 'production',
    AUTH_LOCAL_ADMIN_ENABLED: 'true',
    AUTH_LOCAL_ADMIN_USERNAME: 'aurora-admin',
    AUTH_LOCAL_ADMIN_PASSWORD: 'change-this-temporary-password',
  },
  ({ authenticateLocal }) => {
    assert.throws(
      () => authenticateLocal('aurora-admin', 'change-this-temporary-password'),
      /credenciales por defecto/,
      'production must reject example local credentials'
    );
  }
);

withEnv(
  {
    NODE_ENV: 'production',
    AUTH_JWT_SECRET: 'replace-with-a-long-random-secret',
  },
  ({ signAppToken }) => {
    assert.throws(
      () => signAppToken({ username: 'u', provider: 'azure-ad' }),
      /AUTH_JWT_SECRET/,
      'production must reject placeholder JWT secrets'
    );
  }
);

withEnv(
  {
    NODE_ENV: 'development',
  },
  ({ authenticateLocal, isLocalAdminEnabled }) => {
    assert.equal(isLocalAdminEnabled(), true, 'local admin remains enabled by default in development');
    assert.equal(authenticateLocal('admin', 'admin')?.provider, 'local');
  }
);

withEnv({}, ({ normalizeRoles }) => {
  assert.deepEqual(
    normalizeRoles(['Aurora.Admin', 'Aurora.User'], []),
    ['aurora.admin', 'admin', 'aurora.user', 'user'],
    'Azure app role values must be usable as Aurora internal roles'
  );
  assert.deepEqual(
    normalizeRoles(['Aurora.PAG'], []),
    ['aurora.pag', 'pag'],
    'Azure PAG app role must grant the internal PAG role'
  );
});

withEnv(
  {
    AZURE_AD_ADMIN_GROUP_IDS: 'admin-group-id',
  },
  ({ getAzureAdConfig, resolveAzureAdRoles }) => {
    assert.deepEqual(
      resolveAzureAdRoles({ groups: ['admin-group-id'] }, getAzureAdConfig()),
      ['user', 'admin'],
      'Azure group membership can grant Aurora internal admin role'
    );
  }
);

console.log('auth-config checks passed');
