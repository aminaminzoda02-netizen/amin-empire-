const express=require("express");
const cors=require("cors");
const path=require("path");
const fs=require("fs");
const Database=require("better-sqlite3");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");

const app=express();
app.use(cors());
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

const PORT=process.env.PORT||3000;
const JWT_SECRET=process.env.JWT_SECRET||"CHANGE_ME_IN_PRODUCTION";
const DB_PATH=process.env.DB_PATH||path.join(__dirname,"data","amin_empire.sqlite");
fs.mkdirSync(path.dirname(DB_PATH),{recursive:true});
const db=new Database(DB_PATH);
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'student',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS courses(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 description TEXT DEFAULT '',
 price INTEGER NOT NULL DEFAULT 0,
 currency TEXT NOT NULL DEFAULT 'TJS',
 published INTEGER NOT NULL DEFAULT 1,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS lessons(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 content TEXT DEFAULT '',
 position INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS enrollments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'active',
 UNIQUE(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS progress(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
 completed INTEGER NOT NULL DEFAULT 0,
 UNIQUE(user_id,lesson_id)
);
CREATE TABLE IF NOT EXISTS orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 course_id INTEGER NOT NULL REFERENCES courses(id),
 amount INTEGER NOT NULL,
 currency TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 provider TEXT DEFAULT '',
 provider_ref TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS certificates(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 certificate_id TEXT UNIQUE NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id),
 course_id INTEGER NOT NULL REFERENCES courses(id),
 completion_percent INTEGER NOT NULL DEFAULT 100,
 issued_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS xp_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 event_key TEXT UNIQUE NOT NULL,
 amount INTEGER NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quizzes(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 pass_percent INTEGER NOT NULL DEFAULT 70
);
CREATE TABLE IF NOT EXISTS notifications(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 type TEXT NOT NULL DEFAULT 'info',
 read INTEGER NOT NULL DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS achievements(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT UNIQUE NOT NULL,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 icon TEXT NOT NULL DEFAULT '🏅',
 xp_reward INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS user_achievements(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
 earned_at TEXT DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,achievement_id)
);
CREATE TABLE IF NOT EXISTS quiz_questions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
 question TEXT NOT NULL,
 option_a TEXT NOT NULL,
 option_b TEXT NOT NULL,
 option_c TEXT NOT NULL,
 option_d TEXT NOT NULL,
 correct_option TEXT NOT NULL
);
`);

function auth(req,res,next){
 const h=req.headers.authorization||"";
 const token=h.startsWith("Bearer ")?h.slice(7):"";
 try{req.user=jwt.verify(token,JWT_SECRET);next()}catch(e){return res.status(401).json({error:"Unauthorized"})}
}
function admin(req,res,next){if(req.user?.role!=="admin")return res.status(403).json({error:"Admin only"});next()}
function issueToken(u){return jwt.sign({id:u.id,name:u.name,email:u.email,role:u.role},JWT_SECRET,{expiresIn:"7d"})}
function xpFor(userId){
 const r=db.prepare("SELECT COALESCE(SUM(amount),0) xp FROM xp_events WHERE user_id=?").get(userId);
 const xp=Number(r.xp), level=Math.floor(xp/500)+1, base=(level-1)*500;
 return {xp,level,nextLevelXP:level*500,progressPercent:Math.min(100,Math.round(((xp-base)/500)*100))};
}
function awardXP(userId,key,amount){
 try{db.prepare("INSERT INTO xp_events(user_id,event_key,amount) VALUES(?,?,?)").run(userId,key,amount)}catch(e){}
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"AMIN EMPIRE",time:new Date().toISOString()}));

app.post("/api/auth/register",(req,res)=>{
 const {name,email,password}=req.body||{};
 if(!name||!email||!password||password.length<6)return res.status(400).json({error:"Name, email and password (6+) required"});
 try{
  const hash=bcrypt.hashSync(password,10);
  const info=db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)").run(name,email.toLowerCase(),hash);
  const u=db.prepare("SELECT id,name,email,role FROM users WHERE id=?").get(info.lastInsertRowid);
  res.json({token:issueToken(u),user:u});
 }catch(e){res.status(400).json({error:"Email already exists"})}
});
app.post("/api/auth/login",(req,res)=>{
 const {email,password}=req.body||{};
 const u=db.prepare("SELECT * FROM users WHERE email=?").get((email||"").toLowerCase());
 if(!u||!bcrypt.compareSync(password||"",u.password_hash))return res.status(401).json({error:"Email or password incorrect"});
 const safe={id:u.id,name:u.name,email:u.email,role:u.role};
 res.json({token:issueToken(safe),user:safe});
});
app.get("/api/me",auth,(req,res)=>res.json(req.user));
app.get("/api/me/xp",auth,(req,res)=>res.json(xpFor(req.user.id)));

app.get("/api/courses",(req,res)=>{
 const rows=db.prepare("SELECT id,title,description,price,currency FROM courses WHERE published=1 ORDER BY id DESC").all();
 res.json(rows);
});
app.get("/api/courses/:id",(req,res)=>{
 const c=db.prepare("SELECT id,title,description,price,currency FROM courses WHERE id=?").get(req.params.id);
 if(!c)return res.status(404).json({error:"Course not found"});
 c.lessons=db.prepare("SELECT id,title,content,position FROM lessons WHERE course_id=? ORDER BY position,id").all(c.id);
 res.json(c);
});
app.post("/api/admin/courses",auth,admin,(req,res)=>{
 const {title,description="",price=0,currency="TJS"}=req.body||{};
 if(!title)return res.status(400).json({error:"title required"});
 const r=db.prepare("INSERT INTO courses(title,description,price,currency) VALUES(?,?,?,?)").run(title,description,price,currency);
 res.json(db.prepare("SELECT * FROM courses WHERE id=?").get(r.lastInsertRowid));
});
app.post("/api/admin/courses/:id/lessons",auth,admin,(req,res)=>{
 const {title,content="",position=1}=req.body||{};
 const r=db.prepare("INSERT INTO lessons(course_id,title,content,position) VALUES(?,?,?,?)").run(req.params.id,title,content,position);
 res.json(db.prepare("SELECT * FROM lessons WHERE id=?").get(r.lastInsertRowid));
});
app.post("/api/admin/courses/:courseId/quizzes",auth,admin,(req,res)=>{
  const {title,passPercent=70}=req.body||{};
  if(!title)return res.status(400).json({error:"title required"});
  const c=db.prepare("SELECT id FROM courses WHERE id=?").get(req.params.courseId);
  if(!c)return res.status(404).json({error:"Course not found"});
  const r=db.prepare("INSERT INTO quizzes(course_id,title,pass_percent) VALUES(?,?,?)").run(c.id,title,Number(passPercent));
  res.json(db.prepare("SELECT * FROM quizzes WHERE id=?").get(r.lastInsertRowid));
});
app.post("/api/admin/quizzes/:quizId/questions",auth,admin,(req,res)=>{
  const {question,optionA,optionB,optionC,optionD,correctOption}=req.body||{};
  if(!question||!optionA||!optionB||!optionC||!optionD||!correctOption)return res.status(400).json({error:"All question fields required"});
  const q=db.prepare("SELECT id FROM quizzes WHERE id=?").get(req.params.quizId);
  if(!q)return res.status(404).json({error:"Quiz not found"});
  const r=db.prepare(`INSERT INTO quiz_questions(quiz_id,question,option_a,option_b,option_c,option_d,correct_option)
    VALUES(?,?,?,?,?,?,?)`).run(q.id,question,optionA,optionB,optionC,optionD,correctOption);
  res.json({id:r.lastInsertRowid});
});
app.post("/api/admin/notifications",auth,admin,(req,res)=>{
  const {title,message,type="info",userId}=req.body||{};
  if(!title||!message)return res.status(400).json({error:"title and message required"});
  if(userId){
    const u=db.prepare("SELECT id FROM users WHERE id=?").get(Number(userId));
    if(!u)return res.status(404).json({error:"Student not found"});
    notify(u.id,title,message,type);
    return res.json({ok:true,sent:1});
  }
  const users=db.prepare("SELECT id FROM users WHERE role='student'").all();
  const tx=db.transaction(()=>users.forEach(u=>notify(u.id,title,message,type)));
  tx();
  res.json({ok:true,sent:users.length});
});
app.get("/api/admin/students",auth,admin,(req,res)=>{
  res.json(db.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY id DESC").all());
});
app.get("/api/admin/students/:id",auth,admin,(req,res)=>{
  const id=Number(req.params.id);
  const u=db.prepare("SELECT id,name,email,role,created_at FROM users WHERE id=?").get(id);
  if(!u)return res.status(404).json({error:"Student not found"});
  u.courses=db.prepare(`SELECT c.id,c.title,e.status,
    COALESCE(ROUND(100.0*SUM(CASE WHEN p.completed=1 THEN 1 ELSE 0 END)/NULLIF((SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id),0)),0) progress
    FROM enrollments e JOIN courses c ON c.id=e.course_id
    LEFT JOIN lessons l ON l.course_id=c.id
    LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=e.user_id
    WHERE e.user_id=? GROUP BY c.id,e.status`).all(id);
  u.xp=xpFor(id);
  u.certificates=db.prepare(`SELECT ce.certificate_id,ce.completion_percent,ce.issued_at,c.title courseTitle
    FROM certificates ce JOIN courses c ON c.id=ce.course_id WHERE ce.user_id=? ORDER BY ce.id DESC`).all(id);
  u.achievements=db.prepare(`SELECT a.code,a.title,a.description,a.icon,ua.earned_at
    FROM achievements a JOIN user_achievements ua ON ua.achievement_id=a.id WHERE ua.user_id=? ORDER BY ua.id DESC`).all(id);
  res.json(u);
});
app.get("/api/admin/orders",auth,admin,(req,res)=>{
  res.json(db.prepare(`SELECT o.id,o.amount,o.currency,o.status,o.provider,o.provider_ref,o.created_at,
    u.name userName,u.email,c.title courseTitle
    FROM orders o JOIN users u ON u.id=o.user_id JOIN courses c ON c.id=o.course_id
    ORDER BY o.id DESC`).all());
});
app.get("/api/admin/certificates",auth,admin,(req,res)=>{
  res.json(db.prepare(`SELECT ce.certificate_id,ce.completion_percent,ce.issued_at,
    u.name userName,c.title courseTitle
    FROM certificates ce JOIN users u ON u.id=ce.user_id JOIN courses c ON c.id=ce.course_id
    ORDER BY ce.id DESC`).all());
});
app.put("/api/admin/courses/:id",auth,admin,(req,res)=>{
  const {title,description,price,currency,published}=req.body||{};
  const old=db.prepare("SELECT * FROM courses WHERE id=?").get(req.params.id);
  if(!old)return res.status(404).json({error:"Course not found"});
  db.prepare(`UPDATE courses SET title=?,description=?,price=?,currency=?,published=? WHERE id=?`)
    .run(title??old.title,description??old.description,Number(price??old.price),currency??old.currency,
         published===undefined?old.published:(published?1:0),req.params.id);
  res.json(db.prepare("SELECT * FROM courses WHERE id=?").get(req.params.id));
});
app.delete("/api/admin/courses/:id",auth,admin,(req,res)=>{
  const c=db.prepare("SELECT id FROM courses WHERE id=?").get(req.params.id);
  if(!c)return res.status(404).json({error:"Course not found"});
  db.prepare("DELETE FROM courses WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.get("/api/admin/analytics",auth,admin,(req,res)=>{
  const students=db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n;
  const activeEnrollments=db.prepare("SELECT COUNT(*) n FROM enrollments WHERE status='active'").get().n;
  const paidOrders=db.prepare("SELECT COUNT(*) n FROM orders WHERE status='paid'").get().n;
  const pendingOrders=db.prepare("SELECT COUNT(*) n FROM orders WHERE status='pending'").get().n;
  const revenue=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM orders WHERE status='paid'").get().n;
  const lessonsDone=db.prepare("SELECT COUNT(*) n FROM progress WHERE completed=1").get().n;
  const quizPasses=db.prepare("SELECT COUNT(*) n FROM xp_events WHERE event_key LIKE 'quiz:%'").get().n;
  const certificates=db.prepare("SELECT COUNT(*) n FROM certificates").get().n;
  const courseRows=db.prepare(`SELECT c.id,c.title,
    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) students,
    (SELECT COUNT(*) FROM orders o WHERE o.course_id=c.id AND o.status='paid') paid,
    (SELECT COALESCE(SUM(o.amount),0) FROM orders o WHERE o.course_id=c.id AND o.status='paid') revenue,
    (SELECT COUNT(*) FROM certificates ce WHERE ce.course_id=c.id) certificates
    FROM courses c ORDER BY revenue DESC,students DESC`).all();
  const topStudents=db.prepare(`SELECT u.id,u.name,
    (SELECT COALESCE(SUM(x.amount),0) FROM xp_events x WHERE x.user_id=u.id) xp,
    (SELECT COUNT(*) FROM certificates ce WHERE ce.user_id=u.id) certificates
    FROM users u WHERE u.role='student' ORDER BY xp DESC LIMIT 10`).all();
  res.json({students,activeEnrollments,paidOrders,pendingOrders,revenue,lessonsDone,quizPasses,certificates,courses:courseRows,topStudents});
});
app.get("/api/admin/stats",auth,admin,(req,res)=>{
 const students=db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n;
 const courses=db.prepare("SELECT COUNT(*) n FROM courses").get().n;
 const orders=db.prepare("SELECT COUNT(*) n FROM orders").get().n;
 const paid=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM orders WHERE status='paid'").get().n;
 res.json({students,courses,orders,revenue:paid});
});

app.post("/api/enroll",auth,(req,res)=>{
 const courseId=Number(req.body?.courseId);
 const c=db.prepare("SELECT * FROM courses WHERE id=?").get(courseId);
 if(!c)return res.status(404).json({error:"Course not found"});
 db.prepare("INSERT OR IGNORE INTO enrollments(user_id,course_id,status) VALUES(?,?,?)").run(req.user.id,courseId,"active");
 res.json({ok:true});
});
app.get("/api/my-courses",auth,(req,res)=>{
 const rows=db.prepare(`
 SELECT c.id,c.title,c.description,e.status,
 COALESCE(ROUND(100.0*SUM(CASE WHEN p.completed=1 THEN 1 ELSE 0 END)/NULLIF((SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id),0)),0) progress
 FROM enrollments e JOIN courses c ON c.id=e.course_id
 LEFT JOIN lessons l ON l.course_id=c.id
 LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=e.user_id
 WHERE e.user_id=? GROUP BY c.id,e.status ORDER BY c.id DESC`).all(req.user.id);
 res.json(rows);
});
app.post("/api/progress",auth,(req,res)=>{
 const {courseId,lessonId,completed=true}=req.body||{};
 const enrolled=db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?").get(req.user.id,courseId);
 if(!enrolled)return res.status(403).json({error:"Not enrolled"});
 db.prepare(`INSERT INTO progress(user_id,course_id,lesson_id,completed) VALUES(?,?,?,?)
 ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=excluded.completed`).run(req.user.id,courseId,lessonId,completed?1:0);
 if(completed){awardXP(req.user.id,`lesson:${lessonId}`,50);checkAchievements(req.user.id);notify(req.user.id,"Дарс анҷом ёфт","Шумо як дарсро бомуваффақият анҷом додед.","success");}
 const total=db.prepare("SELECT COUNT(*) n FROM lessons WHERE course_id=?").get(courseId).n;
 const done=db.prepare("SELECT COUNT(*) n FROM progress WHERE user_id=? AND course_id=? AND completed=1").get(req.user.id,courseId).n;
 const pct=total?Math.round(done*100/total):0;
 if(pct===100){
  const c=db.prepare("SELECT title FROM courses WHERE id=?").get(courseId);
  const existing=db.prepare("SELECT certificate_id FROM certificates WHERE user_id=? AND course_id=?").get(req.user.id,courseId);
  if(!existing){
   const year=new Date().getFullYear();
   const prefix=(c.title||"COURSE").replace(/[^A-Za-z]/g,"").slice(0,3).toUpperCase()||"AE";
   const certificateId=`AE-${prefix}-${year}-${String(Date.now()).slice(-6)}`;
   db.prepare("INSERT INTO certificates(certificate_id,user_id,course_id,completion_percent) VALUES(?,?,?,100)").run(certificateId,req.user.id,courseId);
   awardXP(req.user.id,`course:${courseId}`,500);notify(req.user.id,"🎓 Сертификат омода шуд","Шумо курсро 100% анҷом додед. Сертификати шумо омода аст.","certificate");
  }
 }
 res.json({ok:true,progressPercent:pct,xp:xpFor(req.user.id)});
});
app.get("/api/lessons/:id",auth,(req,res)=>{
  const l=db.prepare(`SELECT l.id,l.course_id,l.title,l.content,l.position
    FROM lessons l JOIN enrollments e ON e.course_id=l.course_id
    WHERE l.id=? AND e.user_id=? AND e.status='active'`).get(req.params.id,req.user.id);
  if(!l)return res.status(404).json({error:"Lesson not found or course not unlocked"});
  res.json(l);
});
app.get("/api/courses/:courseId/learning",auth,(req,res)=>{
  const course=db.prepare("SELECT id,title,description FROM courses WHERE id=?").get(req.params.courseId);
  if(!course)return res.status(404).json({error:"Course not found"});
  const enrolled=db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=? AND status='active'").get(req.user.id,course.id);
  if(!enrolled)return res.status(403).json({error:"Course is not unlocked"});
  course.lessons=db.prepare(`SELECT l.id,l.title,l.position,COALESCE(p.completed,0) completed
    FROM lessons l LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=?
    WHERE l.course_id=? ORDER BY l.position,l.id`).all(req.user.id,course.id);
  const total=course.lessons.length, done=course.lessons.filter(x=>x.completed).length;
  course.progressPercent=total?Math.round(done*100/total):0;
  res.json(course);
});

app.get("/api/progress/:courseId",auth,(req,res)=>{
 const rows=db.prepare("SELECT lesson_id,completed FROM progress WHERE user_id=? AND course_id=?").all(req.user.id,req.params.courseId);
 res.json(rows);
});

app.get("/api/quizzes/:courseId",auth,(req,res)=>{
  const enrolled=db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=? AND status='active'").get(req.user.id,req.params.courseId);
  if(!enrolled)return res.status(403).json({error:"Course is not unlocked"});
  const q=db.prepare("SELECT id,title,pass_percent FROM quizzes WHERE course_id=? ORDER BY id").all(req.params.courseId);
  res.json(q);
});
app.get("/api/quizzes/:quizId/questions",auth,(req,res)=>{
  const q=db.prepare("SELECT id,title,course_id,pass_percent FROM quizzes WHERE id=?").get(req.params.quizId);
  if(!q)return res.status(404).json({error:"Quiz not found"});
  const enrolled=db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=? AND status='active'").get(req.user.id,q.course_id);
  if(!enrolled)return res.status(403).json({error:"Course is not unlocked"});
  const questions=db.prepare("SELECT id,question,option_a,option_b,option_c,option_d FROM quiz_questions WHERE quiz_id=? ORDER BY id").all(q.id);
  res.json({quiz:q,questions});
});
app.post("/api/quizzes/:quizId/submit",auth,(req,res)=>{
  const q=db.prepare("SELECT id,title,course_id,pass_percent FROM quizzes WHERE id=?").get(req.params.quizId);
  if(!q)return res.status(404).json({error:"Quiz not found"});
  const enrolled=db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=? AND status='active'").get(req.user.id,q.course_id);
  if(!enrolled)return res.status(403).json({error:"Course is not unlocked"});
  const answers=req.body?.answers||{};
  const questions=db.prepare("SELECT id,correct_option FROM quiz_questions WHERE quiz_id=?").all(q.id);
  let correct=0;
  for(const item of questions){if(String(answers[item.id]||"").toLowerCase()===String(item.correct_option).toLowerCase())correct++}
  const score=questions.length?Math.round(correct*100/questions.length):0;
  const passed=score>=q.pass_percent;
  if(passed){awardXP(req.user.id,`quiz:${q.id}`,100);checkAchievements(req.user.id);notify(req.user.id,"Quiz гузашт!","Шумо Quiz-ро бо муваффақият гузаштед ва +100 XP гирифтед.","success");}
  res.json({quizId:q.id,score,correct,total:questions.length,passed,xp:xpFor(req.user.id)});
});

function ensureAchievements(){
 const defaults=[
  ["FIRST_LESSON","First Step","Аввалин дарсро анҷом додед.","🚀",50],
  ["QUIZ_PASS","Quiz Master","Аввалин Quiz-ро бо муваффақият гузаштед.","🧠",100],
  ["XP_500","500 XP","Ба 500 XP расидед.","⭐",100],
  ["COURSE_COMPLETE","Course Complete","Як курсро 100% анҷом додед.","🏆",500]
 ];
 const ins=db.prepare("INSERT OR IGNORE INTO achievements(code,title,description,icon,xp_reward) VALUES(?,?,?,?,?)");
 const tx=db.transaction(()=>defaults.forEach(x=>ins.run(...x)));tx();
}
ensureAchievements();
function checkAchievements(userId){
 const xp=xpFor(userId).xp;
 const first=db.prepare("SELECT 1 FROM progress WHERE user_id=? AND completed=1 LIMIT 1").get(userId);
 const quiz=db.prepare("SELECT 1 FROM xp_events WHERE user_id=? AND event_key LIKE 'quiz:%' LIMIT 1").get(userId);
 const course=db.prepare("SELECT 1 FROM certificates WHERE user_id=? LIMIT 1").get(userId);
 const checks=[
  ["FIRST_LESSON",!!first],["QUIZ_PASS",!!quiz],["XP_500",xp>=500],["COURSE_COMPLETE",!!course]
 ];
 const get=db.prepare("SELECT id,xp_reward FROM achievements WHERE code=?");
 const add=db.prepare("INSERT OR IGNORE INTO user_achievements(user_id,achievement_id) VALUES(?,?)");
 for(const [code,ok] of checks) if(ok){const a=get.get(code);if(a&&add.run(userId,a.id).changes){}}
}
function notify(userId,title,message,type="info"){
 db.prepare("INSERT INTO notifications(user_id,title,message,type) VALUES(?,?,?,?)").run(userId,title,message,type);
}
app.get("/api/notifications",auth,(req,res)=>{
 res.json(db.prepare("SELECT id,title,message,type,read,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50").all(req.user.id));
});
app.post("/api/notifications/:id/read",auth,(req,res)=>{
 db.prepare("UPDATE notifications SET read=1 WHERE id=? AND user_id=?").run(req.params.id,req.user.id);
 res.json({ok:true});
});
app.post("/api/notifications/read-all",auth,(req,res)=>{
 db.prepare("UPDATE notifications SET read=1 WHERE user_id=?").run(req.user.id);
 res.json({ok:true});
});
app.get("/api/achievements",auth,(req,res)=>{
 checkAchievements(req.user.id);
 const rows=db.prepare(`SELECT a.code,a.title,a.description,a.icon,a.xp_reward,ua.earned_at
 FROM achievements a JOIN user_achievements ua ON ua.achievement_id=a.id
 WHERE ua.user_id=? ORDER BY ua.id DESC`).all(req.user.id);
 res.json(rows);
});
app.get("/api/admin/achievements",auth,admin,(req,res)=>{
 res.json(db.prepare("SELECT * FROM achievements ORDER BY id").all());
});
app.post("/api/admin/achievements",auth,admin,(req,res)=>{
 const {code,title,description,icon="🏅",xpReward=0}=req.body||{};
 if(!code||!title||!description)return res.status(400).json({error:"code, title and description required"});
 try{
  const r=db.prepare("INSERT INTO achievements(code,title,description,icon,xp_reward) VALUES(?,?,?,?,?)")
   .run(code,title,description,icon,Number(xpReward));
  res.json(db.prepare("SELECT * FROM achievements WHERE id=?").get(r.lastInsertRowid));
 }catch(e){res.status(400).json({error:"Achievement code already exists"})}
});

app.get("/api/certificates/verify/:id",(req,res)=>{
 const r=db.prepare(`SELECT ce.certificate_id,ce.completion_percent,ce.issued_at,u.name userName,c.title courseTitle
 FROM certificates ce JOIN users u ON u.id=ce.user_id JOIN courses c ON c.id=ce.course_id WHERE ce.certificate_id=?`).get(req.params.id);
 if(!r)return res.status(404).json({valid:false,error:"Certificate not found"});
 res.json({valid:true,...r});
});
app.get("/api/my-certificates",auth,(req,res)=>{
 res.json(db.prepare(`SELECT ce.certificate_id,ce.completion_percent,ce.issued_at,c.title courseTitle
 FROM certificates ce JOIN courses c ON c.id=ce.course_id WHERE ce.user_id=? ORDER BY ce.id DESC`).all(req.user.id));
});

app.post("/api/orders",auth,(req,res)=>{
 const courseId=Number(req.body?.courseId);
 const c=db.prepare("SELECT * FROM courses WHERE id=?").get(courseId);
 if(!c)return res.status(404).json({error:"Course not found"});
 const r=db.prepare("INSERT INTO orders(user_id,course_id,amount,currency,status,provider) VALUES(?,?,?,?,?,'pending',?)")
   .run(req.user.id,courseId,c.price,c.currency,process.env.PAYMENT_PROVIDER||"unconfigured");
 res.json({ok:true,orderId:r.lastInsertRowid,status:"pending",
   message:"Order created. Connect a verified payment provider to generate a real payment link."});
});
app.post("/api/payments/webhook",express.json(),(req,res)=>{
 const secret=process.env.PAYMENT_WEBHOOK_SECRET||"";
 if(secret && req.headers["x-webhook-secret"]!==secret)return res.status(401).json({error:"Invalid webhook secret"});
 const {orderId,status,providerRef}=req.body||{};
 const order=db.prepare("SELECT * FROM orders WHERE id=?").get(Number(orderId));
 if(!order)return res.status(404).json({error:"Order not found"});
 if(status!=="paid")return res.json({ok:true,ignored:true});
 const tx=db.transaction(()=>{
   db.prepare("UPDATE orders SET status='paid',provider_ref=? WHERE id=?").run(providerRef||"",order.id);
   db.prepare("INSERT OR IGNORE INTO enrollments(user_id,course_id,status) VALUES(?,?,?)").run(order.user_id,order.course_id,"active");
 });
 tx();
 res.json({ok:true,courseUnlocked:true});
});
app.get("/api/orders/:id",auth,(req,res)=>{
 const o=db.prepare("SELECT id,course_id,amount,currency,status,provider,provider_ref,created_at FROM orders WHERE id=? AND user_id=?")
   .get(Number(req.params.id),req.user.id);
 if(!o)return res.status(404).json({error:"Order not found"});
 res.json(o);
});

app.get("/api/admin/students",auth,admin,(req,res)=>{
 const rows=db.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY id DESC").all();
 res.json(rows);
});
app.get("/api/admin/orders",auth,admin,(req,res)=>{
 const rows=db.prepare(`SELECT o.id,o.amount,o.currency,o.status,o.provider,o.provider_ref,o.created_at,
 u.name userName,u.email,c.title courseTitle
 FROM orders o JOIN users u ON u.id=o.user_id JOIN courses c ON c.id=o.course_id
 ORDER BY o.id DESC`).all();
 res.json(rows);
});
app.get("/api/admin/certificates",auth,admin,(req,res)=>{
 const rows=db.prepare(`SELECT ce.certificate_id,ce.completion_percent,ce.issued_at,
 u.name userName,c.title courseTitle
 FROM certificates ce JOIN users u ON u.id=ce.user_id JOIN courses c ON c.id=ce.course_id
 ORDER BY ce.id DESC`).all();
 res.json(rows);
});
app.put("/api/admin/courses/:id",auth,admin,(req,res)=>{
 const {title,description,price,currency,published}=req.body||{};
 const c=db.prepare("SELECT * FROM courses WHERE id=?").get(req.params.id);
 if(!c)return res.status(404).json({error:"Course not found"});
 db.prepare(`UPDATE courses SET title=?,description=?,price=?,currency=?,published=? WHERE id=?`)
   .run(title??c.title,description??c.description,price??c.price,currency??c.currency,
        published===undefined?c.published:(published?1:0),c.id);
 res.json(db.prepare("SELECT * FROM courses WHERE id=?").get(c.id));
});
app.delete("/api/admin/courses/:id",auth,admin,(req,res)=>{
 const c=db.prepare("SELECT id FROM courses WHERE id=?").get(req.params.id);
 if(!c)return res.status(404).json({error:"Course not found"});
 db.prepare("DELETE FROM courses WHERE id=?").run(c.id);
 res.json({ok:true});
});
app.put("/api/admin/lessons/:id",auth,admin,(req,res)=>{
 const l=db.prepare("SELECT * FROM lessons WHERE id=?").get(req.params.id);
 if(!l)return res.status(404).json({error:"Lesson not found"});
 const {title,content,position}=req.body||{};
 db.prepare("UPDATE lessons SET title=?,content=?,position=? WHERE id=?")
   .run(title??l.title,content??l.content,position??l.position,l.id);
 res.json(db.prepare("SELECT * FROM lessons WHERE id=?").get(l.id));
});
app.delete("/api/admin/lessons/:id",auth,admin,(req,res)=>{
 db.prepare("DELETE FROM lessons WHERE id=?").run(req.params.id);
 res.json({ok:true});
});

app.post("/api/ai/chat",auth,(req,res)=>{
 const m=String(req.body?.message||"").trim();
 if(!m)return res.status(400).json({error:"Message required"});
 res.json({answer:`Amin AI demo: «${m}» — ин қисми омӯзишии платформа аст. Барои ҷавоби AI-и воқеӣ API provider-ро дар .env пайваст кардан лозим.`});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`AMIN EMPIRE running on http://localhost:${PORT}`));
