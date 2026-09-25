const Database=require("better-sqlite3"),bcrypt=require("bcryptjs");
const [,,email,password,name="Amin Empire Admin"]=process.argv;
if(!email||!password||password.length<8){console.error("Usage: npm run create-admin -- admin@example.com StrongPassword");process.exit(1)}
const db=new Database(process.env.DB_PATH||"./data/amin_empire.sqlite");
db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin') ON CONFLICT(email) DO UPDATE SET name=excluded.name,password_hash=excluded.password_hash,role='admin'")
.run(name,email.toLowerCase(),bcrypt.hashSync(password,10));
console.log("Admin created/updated:",email);
