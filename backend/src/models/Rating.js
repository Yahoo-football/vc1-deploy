const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Rating extends Model {
    static associate(models) {
      // Rating belongs to rater team
      Rating.belongsTo(models.Team, { foreignKey: 'teamIdRater', as: 'raterTeam' });
      // Rating belongs to rated team
      Rating.belongsTo(models.Team, { foreignKey: 'teamIdRated', as: 'ratedTeam' });
      // Rating belongs to booking
      Rating.belongsTo(models.Booking, { foreignKey: 'bookingId', as: 'booking' });
    }
  }

  Rating.init({
    teamIdRater: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'teams',
        key: 'id'
      }
    },
    teamIdRated: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'teams',
        key: 'id'
      }
    },
    bookingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'bookings',
        key: 'id'
      }
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    review: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sportsmanshipScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    skillLevelScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    punctualityScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    teamOrganizationScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    ratingType: {
      type: DataTypes.ENUM('sportsmanship', 'skill_level', 'punctuality', 'overall'),
      defaultValue: 'overall',
      allowNull: false
    },
    isRecommended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Rating',
    tableName: 'ratings',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        unique: true,
        fields: ['teamIdRater', 'teamIdRated', 'bookingId']
      },
      {
        fields: ['teamIdRated']
      },
      {
        fields: ['rating']
      }
    ]
  });
  return Rating;
};
