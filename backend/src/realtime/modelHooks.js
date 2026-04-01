const { emitToAll } = require('./sseServer');

const broadcastRefresh = (entity, instance) => {
  setImmediate(() => {
    emitToAll('app:refresh', {
      entity,
      id: instance?.id || null
    });
  });
};

const buildRealtimeHooks = (entity) => ({
  afterCreate: (instance) => broadcastRefresh(entity, instance),
  afterUpdate: (instance) => broadcastRefresh(entity, instance),
  afterDestroy: (instance) => broadcastRefresh(entity, instance)
});

module.exports = {
  buildRealtimeHooks
};
