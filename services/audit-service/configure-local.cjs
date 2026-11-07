// Local setup only: preserve every existing credential; never print secret values.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const dotenv = require(path.join(root, 'services/auth-service/node_modules/dotenv'));
const file = path.join(root, 'infrastructure/mongodb/.env');
let text = fs.readFileSync(file, 'utf8'); const mongo = dotenv.parse(text);
const auth = dotenv.parse(fs.readFileSync(path.join(root, 'services/auth-service/.env')));
if (!['localhost', '127.0.0.1', '::1'].includes(auth.DB_HOST) || auth.DB_PORT !== '5432') throw Error('Auth must use local PostgreSQL');
if (['JWT_ACCESS_SECRET', 'JWT_ISSUER', 'JWT_AUDIENCE'].some(k => !auth[k] || auth[k] !== mongo[k])) throw Error('JWT settings must already match Auth; no credentials were replaced');
if (!mongo.MONGO_AUDIT_USERNAME || !mongo.MONGO_AUDIT_PASSWORD) throw Error('Existing audit MongoDB credentials required');
if (mongo.AUDIT_INGEST_KEY?.startsWith('REPLACE_WITH_')) throw Error('Remove only the unused AUDIT_INGEST_KEY placeholder before generating the local service key');
if (!mongo.AUDIT_INGEST_KEY) {
  mongo.AUDIT_INGEST_KEY = crypto.randomBytes(32).toString('hex');
  fs.appendFileSync(file, '\nAUDIT_INGEST_KEY=' + mongo.AUDIT_INGEST_KEY + '\n');
}
if (mongo.AUDIT_INGEST_KEY.length < 32) throw Error('Existing service signing key is too short; not replaced');
const destination = path.join(process.env.APPDATA, 'Microsoft/UserSecrets/5c2bb373-0040-4d78-8432-2380e4fd4542/secrets.json');
fs.mkdirSync(path.dirname(destination), { recursive: true });
const current = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8').replace(/^\uFEFF/, '')) : {};
current['Audit:SigningKey'] = mongo.AUDIT_INGEST_KEY;
fs.writeFileSync(destination, JSON.stringify(current, null, 2));
console.log('Local Audit delivery key configured privately. Existing credentials preserved.');
