const { Model } = require('sequelize');
const { buildRealtimeHooks } = require('../realtime/modelHooks');

module.exports = (sequelize, DataTypes) => {
  class MatchResult extends Model {
    static associate(models) {
      // MatchResult belongs to a booking
      MatchResult.belongsTo(models.Booking, { foreignKey: 'bookingId', as: 'booking' });
      // MatchResult belongs to home team
      MatchResult.belongsTo(models.Team, { foreignKey: 'homeTeamId', as: 'homeTeam' });
      // MatchResult belongs to away team
      MatchResult.belongsTo(models.Team, { foreignKey: 'awayTeamId', as: 'awayTeam' });
      // MatchResult belongs to MVP player
      MatchResult.belongsTo(models.User, { foreignKey: 'mvpPlayerId', as: 'mvpPlayer' });
      // MatchResult belongs to recorder
      MatchResult.belongsTo(models.User, { foreignKey: 'recordedBy', as: 'recorder' });
    }
  }

  MatchResult.init({
    bookingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'bookings',
        key: 'id'
      }
    },
    homeTeamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'teams',
        key: 'id'
      }
    },
    awayTeamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'teams',
        key: 'id'
      }
    },
    homeScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    awayScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    matchStatus: {
      type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'),
      defaultValue: 'scheduled',
      allowNull: false
    },
    mvpPlayerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    matchNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    recordedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    recordedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    matchEvents: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    }
  }, {
    sequelize,
    modelName: 'MatchResult',
    tableName: 'match_results',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['bookingId']
      },
      {
        fields: ['homeTeamId']
      },
      {
        fields: ['awayTeamId']
      },
      {
        fields: ['matchStatus']
      }
    ],
    hooks: buildRealtimeHooks('match_result')
  });
  return MatchResult;
};
