var path = require('path'),
    Hapi = require('hapi'),
    log = require('bole')('user'),
    uuid = require('node-uuid');

exports.register = function User (facet, options, next) {
  facet.views({
    engines: { hbs: require('handlebars') },
    path: path.resolve(__dirname, 'templates')
  });

  var forceAuthConfig = function (handler) {
    return {
      handler: handler,
      auth: {
        mode: 'required'
      },
      plugins: { 'hapi-auth-cookie': {
        redirectTo: '/login'
      }}
    };
  };

  facet.route([
    { path: "/~", method: "GET", config: forceAuthConfig(require('./show-profile')(options.profileFields)) },
    { path: "/profile", method: "GET", config: forceAuthConfig(require('./show-profile')(options.profileFields)) }
  ]);

  facet.route([
    { path: "/~{name}", method: "GET", handler: require('./show-profile')(options.profileFields) },
    { path: "/profile/{name}", method: "GET", handler: require('./show-profile')(options.profileFields) },
    { path: "/~/{name}", method: "GET", handler: require('./show-profile')(options.profileFields) }
  ]);

  facet.route({
    path: "/signup", method: ["GET", "HEAD", "POST"], handler: require('./show-signup')
  });

  facet.route({
    path: "/profile-edit",
    method: ["GET", "HEAD", "PUT", "POST"],
    config: forceAuthConfig(require('./show-profile-edit')(options.profileFields))
  });

  facet.route([
    { path: "/email-edit", method: ["GET", "HEAD", "PUT", "POST"], config: forceAuthConfig(require('./show-email-edit')(options.mail)) },
    { path: "/email-edit/{token*2}", method: ["GET", "HEAD"], config: forceAuthConfig(require('./show-email-edit')(options.mail)) }
  ]);

  facet.route({
    path: "/login",
    method: ["GET", "POST"],
    handler: require('./show-login')
  });

  facet.route({
    path: "/logout",
    method: "GET",
    handler: logout
  });

  facet.route({
    path: "/password",
    method: ["GET", "HEAD", "POST"],
    config: forceAuthConfig(require('./show-password'))
  });

  facet.route({
    path: "/forgot/{token?}",
    method: ["GET", "HEAD", "POST"],
    handler: require('./show-forgot')(options.mail)
  });

  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};

// ===== functions =====
function logout (request, reply) {
  var delSession = request.server.methods.delSession(request),
      user = request.auth.credentials,
      addMetric = request.server.methods.metrics.addMetric,
      addLatencyMetric = request.server.methods.metrics.addPageLatencyMetric,
      timer = { start: Date.now() };

  delSession(user, function (er) {
    if (er) {
      var errId = uuid.v1();
      log.error(errId + ' ' + Hapi.error.internal('unable to delete session for logout'), user)

      var opts = { errId: errId };
      return reply.view('error', opts).code(500);
    }

    timer.end = Date.now();
    addLatencyMetric(timer, 'logout');

    addMetric({ name: 'logout' });
    return reply.redirect('/');
  });
}