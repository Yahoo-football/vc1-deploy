const { Model } = require('sequelize');
const { buildRealtimeHooks } = require('../realtime/modelHooks');



module.exports = (sequelize, DataTypes) => {

  class Booking extends Model {

    static associate(models) {

      // Booking belongs to a field

      Booking.belongsTo(models.Field, { foreignKey: 'fieldId', as: 'field' });

      // Booking belongs to a team

      Booking.belongsTo(models.Team, { foreignKey: 'teamId', as: 'team' });

      // Booking can have an opponent team

      Booking.belongsTo(models.Team, { foreignKey: 'opponentTeamId', as: 'opponentTeam' });

      // Booking belongs to a user (creator)

      Booking.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });

      // Booking has one match result

      Booking.hasOne(models.MatchResult, { foreignKey: 'bookingId', as: 'matchResult' });

      // Booking can have ratings

      Booking.hasMany(models.Rating, { foreignKey: 'bookingId', as: 'ratings' });

      // Booking can receive join requests from other teams
      Booking.hasMany(models.BookingJoinRequest, { foreignKey: 'bookingId', as: 'joinRequests' });

    }

  }



  Booking.init({

    fieldId: {

      type: DataTypes.INTEGER,

      allowNull: false,

      references: {

        model: 'fields',

        key: 'id'

      }

    },

    teamId: {

      type: DataTypes.INTEGER,

      allowNull: false,

      references: {

        model: 'teams',

        key: 'id'

      }

    },

    opponentTeamId: {

      type: DataTypes.INTEGER,

      allowNull: true,

      references: {

        model: 'teams',

        key: 'id'

      }

    },

    startTime: {

      type: DataTypes.DATE,

      allowNull: false,

      validate: {

        isAfterNow(value) {
          const parsed = new Date(value);
          if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
            throw new Error('Start time must be in the future');
          }
        }

      }

    },

    endTime: {

      type: DataTypes.DATE,

      allowNull: false,

      validate: {

        isAfterStartTime(value) {

          if (value <= this.startTime) {

            throw new Error('End time must be after start time');

          }

        }

      }

    },

    status: {

      type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),

      defaultValue: 'pending',

      allowNull: false

    },

    totalPrice: {

      type: DataTypes.DECIMAL(10, 2),

      allowNull: false,

      validate: {

        min: 0

      }

    },

    ownerRevenueLocked: {

      type: DataTypes.BOOLEAN,

      allowNull: false,

      defaultValue: false

    },

    specialRequests: {

      type: DataTypes.TEXT,

      allowNull: true

    },

    createdBy: {

      type: DataTypes.INTEGER,

      allowNull: false,

      references: {

        model: 'users',

        key: 'id'

      }

    },

    isMatchmaking: {

      type: DataTypes.BOOLEAN,

      defaultValue: false,

      allowNull: false

    },

    notes: {

      type: DataTypes.TEXT,

      allowNull: true

    }

  }, {

    sequelize,

    modelName: 'Booking',

    tableName: 'bookings',

    timestamps: true,

    paranoid: false,

    indexes: [

      {

        fields: ['fieldId', 'startTime', 'endTime']

      },

      {

        fields: ['teamId']

      },

      {

        fields: ['status']

      }

    ],
    hooks: buildRealtimeHooks('booking')

  });

  return Booking;

};
