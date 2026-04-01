const { Model } = require('sequelize');
const { buildRealtimeHooks } = require('../realtime/modelHooks');

module.exports = (sequelize, DataTypes) => {
  class RoleRequest extends Model {
    static associate(models) {
      RoleRequest.belongsTo(models.User, { foreignKey: 'requesterId', as: 'requester' });
      RoleRequest.belongsTo(models.User, { foreignKey: 'reviewedBy', as: 'reviewer' });
    }
  }

  RoleRequest.init(
    {
      requesterId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      requestedRole: {
        type: DataTypes.ENUM('captain', 'field_owner'),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
      },
      feeAmountUsd: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      paymentStatus: {
        type: DataTypes.ENUM('paid', 'waived'),
        allowNull: false,
        defaultValue: 'paid'
      },
      paymentReference: {
        type: DataTypes.STRING,
        allowNull: true
      },
      paymentAccountName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      paymentPhone: {
        type: DataTypes.STRING,
        allowNull: true
      },
      paymentScreenshotUrl: {
        type: DataTypes.STRING,
        allowNull: true
      },
      paymentPaidAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      reviewedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'RoleRequest',
      tableName: 'role_requests',
      timestamps: true,
      indexes: [
        {
          fields: ['requesterId']
        },
        {
          fields: ['requestedRole']
        },
        {
          fields: ['status']
        },
        {
          fields: ['paymentStatus']
        }
      ],
      hooks: buildRealtimeHooks('role_request')
    }
  );

  return RoleRequest;
};
