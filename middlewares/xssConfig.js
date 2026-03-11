const xss = require('xss');

module.exports = (req, res, next) => {
    if (req.body) {
    const sanitize = (obj) => {
        for (const key in obj) {
        if (typeof obj[key] === 'string') {
            obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === 'object') {
            sanitize(obj[key]);
        }
        }
    };
    sanitize(req.body);
    }
    next();
};