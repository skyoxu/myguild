module.exports = {
  forbidden: [
    {
      name: 'ui-not-cross-feature',
      from: { path: '^src/ui/' },
      to: { path: '^src/(?!ui|shared|domain)/' },
      severity: 'error',
    },
    {
      name: 'no-tests-imported',
      from: { pathNot: '^tests' },
      to: { path: '^tests' },
      severity: 'error',
    },
  ],
};
