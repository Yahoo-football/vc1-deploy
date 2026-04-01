const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatMessage extends Model {
    static associate(models) {
      ChatMessage.belongsTo(models.ChatConversation, {
        foreignKey: 'conversationId',
        as: 'conversation',
        onDelete: 'CASCADE'
      });
      ChatMessage.belongsTo(models.User, {
        foreignKey: 'senderId',
        as: 'sender',
        onDelete: 'CASCADE'
      });
      ChatMessage.belongsTo(models.User, {
        foreignKey: 'recipientId',
        as: 'recipient',
        onDelete: 'CASCADE'
      });
    }
  }

  ChatMessage.init(
    {
      conversationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'chat_conversations',
          key: 'id'
        }
      },
      senderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      recipientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 5000]
        }
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'ChatMessage',
      tableName: 'chat_messages',
      timestamps: true,
      indexes: [
        { fields: ['conversationId', 'createdAt'] },
        { fields: ['recipientId', 'readAt'] },
        { fields: ['senderId'] }
      ]
    }
  );

  return ChatMessage;
};
