const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FieldReview extends Model {
    static associate(models) {
      FieldReview.belongsTo(models.Field, { foreignKey: 'fieldId', as: 'field' });
      FieldReview.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  FieldReview.init(
    {
      fieldId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'fields',
          key: 'id'
        }
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
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
      comment: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'FieldReview',
      tableName: 'field_reviews',
      timestamps: true,
      paranoid: false,
      indexes: [
        {
          unique: true,
          fields: ['fieldId', 'userId']
        },
        {
          fields: ['fieldId', 'createdAt']
        }
      ]
    }
  );

  return FieldReview;
};
