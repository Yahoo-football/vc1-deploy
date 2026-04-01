const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BookingJoinRequest extends Model {
    static associate(models) {
      BookingJoinRequest.belongsTo(models.Booking, { foreignKey: 'bookingId', as: 'booking' });
      BookingJoinRequest.belongsTo(models.Team, { foreignKey: 'requesterTeamId', as: 'requesterTeam' });
      BookingJoinRequest.belongsTo(models.User, { foreignKey: 'respondedBy', as: 'responder' });
    }
  }

  BookingJoinRequest.init(
    {
      bookingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'bookings',
          key: 'id'
        }
      },
      requesterTeamId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'teams',
          key: 'id'
        }
      },
      requesterCaptainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
      },
      respondedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      respondedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      }
    },
    {
      sequelize,
      modelName: 'BookingJoinRequest',
      tableName: 'booking_join_requests',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['bookingId', 'requesterTeamId']
        },
        {
          fields: ['status']
        },
        {
          fields: ['bookingId']
        }
      ]
    }
  );

  return BookingJoinRequest;
};
