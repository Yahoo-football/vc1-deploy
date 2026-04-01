const { applyLegacySchemaFixes } = require('../src/utils/legacySchemaFix');

describe('applyLegacySchemaFixes', () => {
  it('adds missing role request columns for legacy databases', async () => {
    const existingColumns = new Set([
      'bookings.teamId',
      'bookings.opponentTeamId',
      'bookings.specialRequests',
      'bookings.isMatchmaking',
      'bookings.ownerRevenueLocked',
      'notifications.readAt',
      'notifications.metadata',
      'users.avatarUrl',
      'users.dateOfBirth',
      'users.gender',
      'users.address',
      'users.lastLogin',
      'users.status',
      'teams.shirt_color',
      'teams.jersey_colors',
      'fields.discountPercent',
      'fields.status',
      'fields.isArchived',
      'team_members.joinedAt'
    ]);

    const sequelize = {
      query: jest.fn(async (sql, options = {}) => {
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
          const tableName = options?.replacements?.tableName;
          const columnName = options?.replacements?.columnName;

          if (tableName && columnName) {
            return [existingColumns.has(`${tableName}.${columnName}`) ? [{ 1: 1 }] : []];
          }

          if (sql.includes("TABLE_NAME = 'team_members'") && sql.includes("COLUMN_NAME = 'status'")) {
            return [[{ columnType: "enum('pending','active','inactive')" }]];
          }

          if (sql.includes("TABLE_NAME = 'team_members'") && sql.includes("COLUMN_NAME = 'joinedAt'")) {
            return [[{ isNullable: 'YES' }]];
          }
        }

        if (sql.startsWith('ALTER TABLE')) {
          return [[], undefined];
        }

        return [[], undefined];
      })
    };

    await applyLegacySchemaFixes(sequelize);

    const alterStatements = sequelize.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql) => sql.startsWith('ALTER TABLE `role_requests` ADD COLUMN'));

    expect(alterStatements).toEqual(
      expect.arrayContaining([
        expect.stringContaining('`requesterId` INT NOT NULL'),
        expect.stringContaining("`requestedRole` ENUM('captain','field_owner') NOT NULL DEFAULT 'captain'"),
        expect.stringContaining('`feeAmountUsd` DECIMAL(10,2) NOT NULL DEFAULT 0'),
        expect.stringContaining("`paymentStatus` ENUM('paid','waived') NOT NULL DEFAULT 'paid'"),
        expect.stringContaining('`paymentReference` VARCHAR(255) NULL'),
        expect.stringContaining('`paymentPaidAt` DATETIME NULL'),
        expect.stringContaining('`reviewedBy` INT NULL'),
        expect.stringContaining('`reviewedAt` DATETIME NULL')
      ])
    );
  });
});
