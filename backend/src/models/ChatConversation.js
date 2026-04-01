
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatConversation extends Model {
    static associate(models) {

      ChatConversation.belongsTo(models.User, {
        foreignKey: 'userOneId',
        as: 'userOne',
        onDelete: 'CASCADE'
      });

      ChatConversation.belongsTo(models.User, {
        foreignKey: 'userTwoId',
        as: 'userTwo',
        onDelete: 'CASCADE'
      });

      ChatConversation.belongsTo(models.User, {
        foreignKey: 'createdBy',
        as: 'creator',
        onDelete: 'CASCADE'
      });
      ChatConversation.hasMany(models.ChatMessage, {
        foreignKey: 'conversationId',
        as: 'messages',
        onDelete: 'CASCADE'
      });
    }
  }

  ChatConversation.init(
    {
      directKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true
        }
      },
      userOneId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      userTwoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      lastMessageAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'ChatConversation',
      tableName: 'chat_conversations',
      timestamps: true,
      indexes: [
        { unique: true, fields: ['directKey'] },
        { fields: ['userOneId'] },
        { fields: ['userTwoId'] },
        { fields: ['lastMessageAt'] }
      ],
      validate: {
        distinctParticipants() {
          if (Number(this.userOneId) === Number(this.userTwoId)) {
            throw new Error('A conversation requires two different users.');
          }
        }
      }
    }
  );

  return ChatConversation;
};
