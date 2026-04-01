const tableHasColumn = async (sequelize, tableName, columnName) => {
  const [rows] = await sequelize.query(
    `
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = :tableName
      AND COLUMN_NAME = :columnName
    LIMIT 1
    `,
    { replacements: { tableName, columnName } }
  );
  return Array.isArray(rows) && rows.length > 0;
};

const addColumnIfMissing = async (sequelize, tableName, columnName, definition) => {
  const exists = await tableHasColumn(sequelize, tableName, columnName);
  if (exists) return false;

  await sequelize.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  return true;
};

const normalizeTeamMemberStatuses = async (sequelize) => {
  const [rows] = await sequelize.query(
    `
    SELECT COLUMN_TYPE AS columnType
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'team_members'
      AND COLUMN_NAME = 'status'
    LIMIT 1
    `
  );

  const columnType = rows?.[0]?.columnType || '';
  if (!columnType) return false;

  const usesLegacyStatuses = columnType.includes("'accepted'") || columnType.includes("'declined'");
  const usesCurrentStatuses = columnType.includes("'active'") && columnType.includes("'inactive'");

  if (!usesLegacyStatuses && usesCurrentStatuses) {
    return false;
  }

  await sequelize.query(`
    UPDATE \`team_members\`
    SET \`status\` = CASE
      WHEN \`status\` = 'accepted' THEN 'pending'
      WHEN \`status\` = 'declined' THEN 'pending'
      ELSE \`status\`
    END
    WHERE \`status\` IN ('accepted', 'declined')
  `);

  await sequelize.query(`
    ALTER TABLE \`team_members\`
    MODIFY COLUMN \`status\` ENUM('pending','active','inactive') NOT NULL DEFAULT 'pending'
  `);

  await sequelize.query(`
    UPDATE \`team_members\`
    SET \`status\` = CASE
      WHEN \`isActive\` = 1 AND \`status\` = 'pending' THEN 'active'
      WHEN \`isActive\` = 0 AND \`status\` = 'pending' THEN 'inactive'
      ELSE \`status\`
    END
  `);

  return true;
};

const ensureTeamMemberJoinedAtNullable = async (sequelize) => {
  const [rows] = await sequelize.query(
    `
    SELECT IS_NULLABLE AS isNullable
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'team_members'
      AND COLUMN_NAME = 'joinedAt'
    LIMIT 1
    `
  );

  const isNullable = rows?.[0]?.isNullable || '';
  if (!isNullable || isNullable === 'YES') {
    return false;
  }

  await sequelize.query(`
    UPDATE \`team_members\`
    SET \`joinedAt\` = COALESCE(\`joinedAt\`, \`createdAt\`, NOW())
    WHERE \`joinedAt\` IS NULL
  `);

  await sequelize.query(`
    ALTER TABLE \`team_members\`
    MODIFY COLUMN \`joinedAt\` DATETIME NULL DEFAULT NULL
  `);

  return true;
};

const ensureTeamShirtColorColumn = async (sequelize) => {
  const hasSnakeCase = await tableHasColumn(sequelize, 'teams', 'shirt_color');
  if (hasSnakeCase) return false;

  const hasCamelCase = await tableHasColumn(sequelize, 'teams', 'shirtColor');
  await sequelize.query('ALTER TABLE `teams` ADD COLUMN `shirt_color` VARCHAR(7) NULL');

  if (hasCamelCase) {
    await sequelize.query(`
      UPDATE \`teams\`
      SET \`shirt_color\` = UPPER(
        CASE
          WHEN \`shirtColor\` IS NULL OR TRIM(\`shirtColor\`) = '' THEN NULL
          WHEN LEFT(TRIM(\`shirtColor\`), 1) = '#' THEN TRIM(\`shirtColor\`)
          ELSE CONCAT('#', TRIM(\`shirtColor\`))
        END
      )
      WHERE \`shirt_color\` IS NULL
    `);
  }

  return true;
};

const ensureTeamJerseyColorsColumn = async (sequelize) => {
  const hasSnakeCase = await tableHasColumn(sequelize, 'teams', 'jersey_colors');
  if (!hasSnakeCase) {
    await sequelize.query('ALTER TABLE `teams` ADD COLUMN `jersey_colors` JSON NULL');
  }

  const hasShirtColor = await tableHasColumn(sequelize, 'teams', 'shirt_color');
  const hasLegacyShirtColor = await tableHasColumn(sequelize, 'teams', 'shirtColor');

  if (hasShirtColor) {
    await sequelize.query(`
      UPDATE \`teams\`
      SET \`jersey_colors\` = JSON_ARRAY(UPPER(\`shirt_color\`))
      WHERE \`shirt_color\` IS NOT NULL
        AND TRIM(\`shirt_color\`) <> ''
        AND (\`jersey_colors\` IS NULL OR JSON_LENGTH(\`jersey_colors\`) = 0)
    `);
  } else if (hasLegacyShirtColor) {
    await sequelize.query(`
      UPDATE \`teams\`
      SET \`jersey_colors\` = JSON_ARRAY(
        UPPER(
          CASE
            WHEN LEFT(TRIM(\`shirtColor\`), 1) = '#' THEN TRIM(\`shirtColor\`)
            ELSE CONCAT('#', TRIM(\`shirtColor\`))
          END
        )
      )
      WHERE \`shirtColor\` IS NOT NULL
        AND TRIM(\`shirtColor\`) <> ''
        AND (\`jersey_colors\` IS NULL OR JSON_LENGTH(\`jersey_colors\`) = 0)
    `);
  }

  return !hasSnakeCase;
};

const applyLegacySchemaFixes = async (sequelize) => {
  const changes = [];

  if (await addColumnIfMissing(sequelize, 'bookings', 'teamId', 'INT NULL')) {
    changes.push('bookings.teamId');
  }
  if (await addColumnIfMissing(sequelize, 'bookings', 'opponentTeamId', 'INT NULL')) {
    changes.push('bookings.opponentTeamId');
  }
  if (await addColumnIfMissing(sequelize, 'bookings', 'specialRequests', 'TEXT NULL')) {
    changes.push('bookings.specialRequests');
  }
  if (await addColumnIfMissing(sequelize, 'bookings', 'isMatchmaking', 'TINYINT(1) NOT NULL DEFAULT 0')) {
    changes.push('bookings.isMatchmaking');
  }
  if (await addColumnIfMissing(sequelize, 'bookings', 'ownerRevenueLocked', 'TINYINT(1) NOT NULL DEFAULT 0')) {
    changes.push('bookings.ownerRevenueLocked');
  }
  await sequelize.query(`
    UPDATE \`bookings\`
    SET \`ownerRevenueLocked\` = 1
    WHERE \`status\` IN ('confirmed', 'completed')
      AND COALESCE(\`ownerRevenueLocked\`, 0) = 0
  `);
  if (await addColumnIfMissing(sequelize, 'notifications', 'readAt', 'DATETIME NULL')) {
    changes.push('notifications.readAt');
  }
  if (await addColumnIfMissing(sequelize, 'notifications', 'metadata', 'JSON NULL')) {
    changes.push('notifications.metadata');
  }

  if (await addColumnIfMissing(sequelize, 'role_requests', 'requesterId', 'INT NOT NULL')) {
    changes.push('role_requests.requesterId');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'requestedRole', "ENUM('captain','field_owner') NOT NULL DEFAULT 'captain'")) {
    changes.push('role_requests.requestedRole');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'feeAmountUsd', 'DECIMAL(10,2) NOT NULL DEFAULT 0')) {
    changes.push('role_requests.feeAmountUsd');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'paymentStatus', "ENUM('paid','waived') NOT NULL DEFAULT 'paid'")) {
    changes.push('role_requests.paymentStatus');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'paymentReference', 'VARCHAR(255) NULL')) {
    changes.push('role_requests.paymentReference');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'paymentAccountName', 'VARCHAR(255) NULL')) {
    changes.push('role_requests.paymentAccountName');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'paymentPhone', 'VARCHAR(50) NULL')) {
    changes.push('role_requests.paymentPhone');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'paymentScreenshotUrl', 'VARCHAR(255) NULL')) {
    changes.push('role_requests.paymentScreenshotUrl');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'paymentPaidAt', 'DATETIME NULL')) {
    changes.push('role_requests.paymentPaidAt');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'reviewedBy', 'INT NULL')) {
    changes.push('role_requests.reviewedBy');
  }
  if (await addColumnIfMissing(sequelize, 'role_requests', 'reviewedAt', 'DATETIME NULL')) {
    changes.push('role_requests.reviewedAt');
  }

  if (await addColumnIfMissing(sequelize, 'fields', 'closureMessage', 'TEXT NULL')) {
    changes.push('fields.closureMessage');
  }
  if (await addColumnIfMissing(sequelize, 'fields', 'closureStartAt', 'DATETIME NULL')) {
    changes.push('fields.closureStartAt');
  }
  if (await addColumnIfMissing(sequelize, 'fields', 'closureEndAt', 'DATETIME NULL')) {
    changes.push('fields.closureEndAt');
  }
  if (await addColumnIfMissing(sequelize, 'fields', 'country', 'VARCHAR(100) NULL')) {
    changes.push('fields.country');
  }

  if (await addColumnIfMissing(sequelize, 'users', 'avatarUrl', 'VARCHAR(255) NULL')) {
    changes.push('users.avatarUrl');
  }
  if (await addColumnIfMissing(sequelize, 'users', 'dateOfBirth', 'DATE NULL')) {
    changes.push('users.dateOfBirth');
  }
  if (await addColumnIfMissing(sequelize, 'users', 'gender', "ENUM('male','female','other') NULL")) {
    changes.push('users.gender');
  }
  if (await addColumnIfMissing(sequelize, 'users', 'address', 'TEXT NULL')) {
    changes.push('users.address');
  }
  if (await addColumnIfMissing(sequelize, 'users', 'lastLogin', 'DATETIME NULL')) {
    changes.push('users.lastLogin');
  }
  if (await addColumnIfMissing(sequelize, 'users', 'status', "ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active'")) {
    changes.push('users.status');
  }
  if (await ensureTeamShirtColorColumn(sequelize)) {
    changes.push('teams.shirt_color');
  }
  if (await ensureTeamJerseyColorsColumn(sequelize)) {
    changes.push('teams.jersey_colors');
  }

  if (await addColumnIfMissing(sequelize, 'fields', 'discountPercent', 'DECIMAL(5,2) NOT NULL DEFAULT 0')) {
    changes.push('fields.discountPercent');
  }
  if (await addColumnIfMissing(sequelize, 'fields', 'status', "ENUM('available','unavailable','maintenance') NOT NULL DEFAULT 'available'")) {
    changes.push('fields.status');
  }
  if (await addColumnIfMissing(sequelize, 'fields', 'isArchived', 'TINYINT(1) NOT NULL DEFAULT 0')) {
    changes.push('fields.isArchived');
  }

  if (await addColumnIfMissing(sequelize, 'ratings', 'teamIdRater', 'INT NULL')) {
    changes.push('ratings.teamIdRater');
  }
  if (await addColumnIfMissing(sequelize, 'ratings', 'teamIdRated', 'INT NULL')) {
    changes.push('ratings.teamIdRated');
  }
  if (await addColumnIfMissing(sequelize, 'ratings', 'bookingId', 'INT NULL')) {
    changes.push('ratings.bookingId');
  }
  if (await addColumnIfMissing(sequelize, 'ratings', 'review', 'TEXT NULL')) {
    changes.push('ratings.review');
  }
  if (await addColumnIfMissing(sequelize, 'ratings', 'sportsmanshipScore', 'INT NULL')) {
    changes.push('ratings.sportsmanshipScore');
  }
  if (await addColumnIfMissing(sequelize, 'ratings', 'skillLevelScore', 'INT NULL')) {
    changes.push('ratings.skillLevelScore');
  }
  if (await addColumnIfMissing(sequelize, 'ratings', 'punctualityScore', 'INT NULL')) {
    changes.push('ratings.punctualityScore');
  }
  if (await addColumnIfMissing(sequelize, 'ratings', 'teamOrganizationScore', 'INT NULL')) {
    changes.push('ratings.teamOrganizationScore');
  }
  if (
    await addColumnIfMissing(
      sequelize,
      'ratings',
      'ratingType',
      "ENUM('sportsmanship','skill_level','punctuality','overall') NOT NULL DEFAULT 'overall'"
    )
  ) {
    changes.push('ratings.ratingType');
  }
  if (await addColumnIfMissing(sequelize, 'ratings', 'isRecommended', 'TINYINT(1) NOT NULL DEFAULT 0')) {
    changes.push('ratings.isRecommended');
  }

  if (await normalizeTeamMemberStatuses(sequelize)) {
    changes.push('team_members.status');
  }
  if (await ensureTeamMemberJoinedAtNullable(sequelize)) {
    changes.push('team_members.joinedAt');
  }

  if (changes.length > 0) {
    console.log(`Applied legacy schema fixes: ${changes.join(', ')}`);
  }
};

module.exports = {
  applyLegacySchemaFixes
};
