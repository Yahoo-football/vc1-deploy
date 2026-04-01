const { Model } = require('sequelize');
const { buildRealtimeHooks } = require('../realtime/modelHooks');

module.exports = (sequelize, DataTypes) => {
  class Team extends Model {
    static associate(models) {
      Team.belongsTo(models.User, {
        foreignKey: 'captainId',
        as: 'captain'
      });

      Team.belongsTo(models.Field, {
        foreignKey: 'homeFieldId',
        as: 'homeField'
      });

      Team.hasMany(models.TeamMember, {
        foreignKey: 'teamId',
        as: 'teamMembers'
      });

      Team.hasMany(models.Booking, {
        foreignKey: 'teamId',
        as: 'bookings'
      });

      Team.hasMany(models.BookingJoinRequest, {
        foreignKey: 'requesterTeamId',
        as: 'bookingJoinRequests'
      });

      Team.hasMany(models.MatchResult, {
        foreignKey: 'homeTeamId',
        as: 'homeMatches'
      });

      Team.hasMany(models.MatchResult, {
        foreignKey: 'awayTeamId',
        as: 'awayMatches'
      });
    }
  }

  Team.init(
    {
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [2, 100]
        }
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      captainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      maxPlayers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 11,
        validate: {
          min: 1,
          max: 50
        }
      },
      skillLevel: {
        type: DataTypes.ENUM('beginner', 'intermediate', 'advanced', 'professional'),
        allowNull: false,
        defaultValue: 'intermediate'
      },
      homeFieldId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'fields',
          key: 'id'
        }
      },
      logoUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        validate: {
          isValidLogoUrl(value) {
            if (!value) return;
            const isAbsoluteUrl = /^https?:\/\/.+/i.test(value);
            const isLocalUploadPath = /^\/uploads\/.+/i.test(value);
            if (!isAbsoluteUrl && !isLocalUploadPath) {
              throw new Error('logoUrl must be an absolute URL or /uploads path');
            }
          }
        }
      },
      shirtColor: {
        type: DataTypes.STRING(7),
        allowNull: true,
        validate: {
          isHexColor(value) {
            if (!value) return;
            if (!/^#[0-9A-F]{6}$/i.test(value)) {
              throw new Error('shirtColor must be a valid hex color like #22C55E');
            }
          }
        }
      },
      jerseyColors: {
        type: DataTypes.JSON,
        allowNull: true,
        validate: {
          isValidJerseyColors(value) {
            if (value === null || value === undefined) return;
            if (!Array.isArray(value)) {
              throw new Error('jerseyColors must be an array');
            }
            if (value.length === 0) {
              throw new Error('jerseyColors must include at least one color');
            }
            if (value.length > 5) {
              throw new Error('jerseyColors can include up to 5 colors');
            }
            for (const color of value) {
              if (!/^#[0-9A-F]{6}$/i.test(String(color || ''))) {
                throw new Error('Each jersey color must be a valid hex color like #22C55E');
              }
            }
          }
        }
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      sequelize,
      modelName: 'Team',
      tableName: 'teams',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['captain_id'] },
        { fields: ['home_field_id'] },
        { fields: ['skill_level'] },
        { fields: ['is_active'] }
      ],
      hooks: buildRealtimeHooks('team')
    }
  );

  return Team;
};
