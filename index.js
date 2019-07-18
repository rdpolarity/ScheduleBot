const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const moment = require('moment');
const MomentRange = require('moment-range');
const momentz = require('moment-timezone');
const Moment = MomentRange.extendMoment(moment);
const requireNew = require('require-new');
const fs = require('fs');
const svgToImg = require("svg-to-img");
const mysql = require('mysql');
const cheerio = require('cheerio')
const path = require('path');
// const colors = require('colors');
moment.locale("en-AU");

const debug = false;

client.on('ready', async () => {
  updateschedules();
  setInterval( async () => { 
    let timeTarget = setTime(23,59).getTime();
    let timeNow =  new Date().getTime();
    let timeOffset = (timeTarget - timeNow);
    // if (timeOffset > 0) {console.log(timeOffset)}
    if (timeOffset == 0){
      console.log("UPDATED SCHEDULES");
      updateschedules();
    }
   }, 1)
})

const setTime = (hour,minute) => {
  var t = new Date();
  t.setHours(hour);
  t.setMinutes(minute);
  t.setSeconds(0);
  t.setMilliseconds(0);
  return t;
}

async function updateschedules() {
  let teamtable = await tquery("SELECT * FROM `teams`");
  for (let i = 0; i < teamtable.length; i++) {
    let scheduleChannel = client.channels.find(channel => channel.id === teamtable[i].channel)
    if (!scheduleChannel) continue;
    let message = await getWeek(teamtable[i].team);
    // message += "Type ``!refresh`` if you can't see schedule";
    let logs = await scheduleChannel.fetchMessages();
    if (logs.size >= 1 && logs.last(1)[0].author.id == '572603641278758912') {
      logs.last(1)[0].edit(message);
      if (logs.size > 1) {
        scheduleChannel.bulkDelete(logs.size - 1);
      }
    } else {
      scheduleChannel.bulkDelete(logs.size)
      scheduleChannel.send(message);
    }
  }
}

const cssblock = (lines,symbol) => ["```css",...lines,"```"].join(symbol)
const sqlmatch = (team, date) => `SELECT * FROM \`${team}\` WHERE \`date\` = '${date}'`

// db.connect(err => {
//   if(err) {
//     console.log('error when connecting to db:', err);
//     setTimeout(handleDisconnect, 2000);
//   }
//   console.log("Connected to Paradigm!");
// });

// tb.connect(err => {
//   if(err) {
//     console.log('error when connecting to db:', err);
//     setTimeout(handleDisconnect, 2000);
//   }
//   console.log("Connected to TeamInfo!");
// });

const tquery = (sql) => new Promise((res,rej) => {
  const tb = mysql.createConnection({
    host: "124.188.28.77",
    user: "rdpolarity",
    password: "18MellAM@cgs",
    database: "teaminfo"
  });
  tb.query(sql, (err,response) => {
    if (err) return rej(err)
    res(response);
  })
  tb.end();
})

const query = (sql) => new Promise((res,rej) => {
  const db = mysql.createConnection({
    host: "124.188.28.77",
    user: "rdpolarity",
    password: "18MellAM@cgs",
    database: "paradigm"
  });
  db.query(sql, (err,response) => {
    if (err) return rej(err)
    res(response);
  })
  db.end();
})

const orderTableByDate = async (object) => {
  let sorted = object.sort((a,b) => {
    return moment(`${a.Date} ${a.Start}`,"DD/MM/YYYY h:mmA").diff(moment(`${b.Date} ${b.Start}`,"DD/MM/YYYY h:mmA"))
  })
  return sorted;
}

// ! ADD TABLE
const addtable = async (name,id) => {
  let isTable = await checkTable(name)
  if (!isTable) {
    sql = "CREATE TABLE `" + name + "` (`ID` int(11) NOT NULL AUTO_INCREMENT,`Opponent` varchar(50) NOT NULL,`Type` varchar(50) NOT NULL,`Date` varchar(50) NOT NULL,`Start` varchar(50) NOT NULL,`End` varchar(50) NOT NULL,PRIMARY KEY (`ID`)) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=latin1"
    await query(sql);
    sql = "INSERT INTO `teams` (`team`, `channel`) VALUES ('" + name + "', '" + id + "')"
    await tquery(sql);
    updateschedules();
    return codeBlock(`${name} Has Been Created!`);
  }
  else { return codeBlock(`[${name} Already Exists!]`); }
}

const checkTable = async (table) => {
  let sql = `SELECT 1 FROM ${table} LIMIT 1;`;
  let result = true;
  await query(sql).catch(() => result = false);
  return result;
}

// ! REMOVE TABLE
const removetable = async (name) => {
  let isTable = await checkTable(name);
  if (isTable) {
      sql = "DROP TABLE `" + name + "`"
      await query(sql);
      sql = "DELETE FROM `teams` WHERE `teams`.`team` = '" + name + "'";
      await tquery(sql);
      updateschedules();
      return codeBlock(`[${name} Has Been Removed!]`);
  }
  else { return codeBlock(`[${name} Does not exist!]`); }
}

// ! LIST TEAMS
const teamlist = async () => {
  let sql = `SELECT * FROM \`teams\``
  let teams = await tquery(sql)
  let reply = [];
  for (let i = 0; i < teams.length; i++) {
    reply += `[Name:]${teams[i].team}\n[Channel:]${teams[i].channel}\n`;
    reply += centerText(``, 23, "─") + "\n";
  }
  if (!reply) { reply += "[No Teams Found!]"; }
  return codeBlock(reply);
}

const editTable = async (name, newname, newID) => {
  let isTable = await checkTable(name);
  if (!isTable) return codeBlock(`[${name} Does Not Exists!]`);
  let sql = `UPDATE \`teams\` SET \`team\` = '${newname}', \`channel\` = '${newID}' WHERE \`teams\`.\`team\` = '${name}'`;
  tquery(sql);
  sql = `RENAME TABLE \`${name}\` TO \`${newname}\``
  query(sql);  
  updateschedules();
  return codeBlock(`[${name}] has been updated to [${newname}] with the ID [${newID}]`)
}

const codeBlock = (message) => {
  block = ""
  block += "```css\n"
  block += (message + "\n")
  block += "```"
  return block
}

async function getDay(team, date) {
  let isTable = await checkTable(team);
  if (isTable == false) return codeBlock(`[${team}] could not be found!`);

  let reply = [];
  let gap = 28;
  let day = moment(date, "DD/MM/YYYY").format("dddd"); //?

  let matches = await query(sqlmatch(team, date));
  matches = await orderTableByDate(matches);
  reply.push(centerText(`[${day}: ${date}]`, gap, "━"));
  if (matches.length != 0) {
    for (let i = 0; i < matches.length; i++) {
      reply.push(`${centerText(`{ID: ${matches[i].ID}}`, gap, "─")}`);
      reply.push(`${centerText(`{${matches[i].Start}} - {${matches[i].End}}`, gap, "-")}`);
      reply.push(`${centerText(`#${matches[i].Type} ${matches[i].Opponent}`, gap, " ")}`);
    }
  } else { reply.push(centerText("", gap, "#")); }
  return cssblock(reply,"\n");
}

const centerText = (message, spaces, char) => {
  let total = spaces - message.length
  let margin = char.repeat(total / 2)
  return `${margin}${message}${margin}`
}

async function getWeek(team) {
    let isTable = await checkTable(team);
    if (isTable == false) return codeBlock(`[${team}] could not be found!`);

    let day = moment().day();
    let reply = [];
    let gap = 26;
    reply.push(centerText(`**[THIS WEEK]**`, gap, "━"));
    for (let i = day; i <= day + 6; i++) {
      dayOfWeek = moment().day(i).format("DD/MM/YYYY");
      reply.push(await getDay(team,dayOfWeek));
      if (i == 7) { reply.push(centerText(`**[NEXT WEEK]**`, gap, "━")); } 
    }
    const embed = new Discord.RichEmbed()
    .setAuthor(`${team.toUpperCase()} schedule in ${momentz().tz("Australia/Sydney").format("z")}`)
    .setColor("#ff0000")  
    .setDescription(reply)
    .setFooter("Last Updated")
    .setTimestamp()
    return embed;
}

const info = () => {
  message = ["```css\n"]
  message += "[Paradigm Bot Info]\n"
  message += `{Author: "${config.author}"}\n`
  message += `{Version: "${config.version}"}\n`
  message += `{Prefix: "${config.prefix}"}\n`
  message += "```"
  return message
}

const help = (msg) => {
  let cmds = requireNew('./commands.json');

  let objects = []
  let reply = []
  const embed = new Discord.RichEmbed()
  .setAuthor("💻 Command List")
  .setColor("#2D9CDB")
  .setThumbnail(symbolInfo)
  for (let i in cmds) {
    roles = msg.member.roles;
    if (roles.some(role => {return cmds[i].permission.some(perm => {
        return role.name.toLowerCase().includes(perm);
      })
    })) {
      let argFormat = cmds[i].arguments.map(i => '``' + i + '``').join(" ");
      embed.addField(`!${i} ${argFormat}`,cmds[i].description);
      // reply.push(`!${i} [${cmds[i].arguments}] #${cmds[i].permission.join(",#")}`)
      // reply.push(`{${cmds[i].description}}`);
    }
  }
  return embed;
}

// const makeText = async (text) => {
//   let td = requireNew("./templates.json");
//   let data = fs.readFileSync(`./Templates/${template}`, "utf8");
//   let $ = cheerio.load(data);
//   name = name.split("/");
//   if (name.length >= 1) {
//     let size = 50
//     let userprop = name[0].replace(/_/g," ");
//     $("#USERNAME").text("");
//     $("#USERNAME").attr("text-anchor","start");
//     $("#USERNAME").attr("dominant-baseline","middle");
//     $("#USERNAME").attr("font-size",size);
//     $("#USERNAME").attr("x","0");
//     $("#USERNAME").attr("y","50%");
//     $("#USERNAME").text(userprop);
//     $("svg").attr("width",`${userprop.length * size}`);
//   }
//   if (name.length >= 2) {
//     $("#USERNAME").attr("fill",name[1]);
//   }
// }

const makeGraphic = async (template,name) => {
  // let td = requireNew("./templates.json");
  let tpath = path.join(__dirname,"Templates",template + ".svg")
  if (!fs.existsSync(tpath)) return codeBlock(`[${template}] Cannot Be Found!`)
  let data = fs.readFileSync(tpath, "utf8");
  let $ = cheerio.load(data, { lowerCaseTags: true, lowerCaseAttributeNames : true });
  $("#username tspan").text(name.toUpperCase());
  let svgstring = $.html("svg");
  
  await svgToImg.from(svgstring).toPng({path: path.join(__dirname,"temp.png")});
  return {file: 'temp.png'};
}

async function scrimAdd(team, opponent, type, date, start, end) {
  let isTable = await checkTable(team);
  if (isTable == false) return codeBlock(`[${team}] could not be found!`);
  if (!moment(date, "DD/MM/YYYY", true).isValid()) return codeBlock(`Date is incorrect, use format [DD/MM/YYYY]!`);
  if (!moment(start, "h:mmA", true).isValid()) return codeBlock(`Start time is incorrect, use format [H:MM AM/PM]!`);
  if (!moment(end, "h:mmA", true).isValid()) return codeBlock(`End time is incorrect, use format [H:MM AM/PM]!`);
  if (moment(start,"h:mmA").isAfter(moment(end,"h:mmA"))) return codeBlock(`Start time cannot be before End time!`)
  let matches = await query(`SELECT * FROM ${team}`);
  let range = Moment.range(moment(`${date} ${start}`,"DD/MM/YYYY h:mmA"),moment(`${date} ${end}`,"DD/MM/YYYY h:mmA"));
  for (let i = 0; i < matches.length; i++) {
    let dbrange = Moment.range(moment(`${matches[i].Date} ${matches[i].Start}`,"DD/MM/YYYY h:mmA"),moment(`${matches[i].Date} ${matches[i].End}`,"DD/MM/YYYY h:mmA"))
    if (dbrange.overlaps(range)) return codeBlock(`Date and time overlaps with existing match!`);
  }

  sql = `INSERT INTO \`${team}\` (\`ID\`, \`Opponent\`, \`Type\`, \`Date\`, \`Start\`, \`End\`) VALUES (NULL, '${opponent}', '${type}', '${date}', '${start}', '${end}');`
  updateschedules();
  await query(sql);
  return codeBlock(`A [${type}] against [${opponent}] was added on [${date}] for [${team}]`)
}

const scrimRemove = async (team,id) => {
  let isTable = await checkTable(team);
  if (isTable == false) { return codeBlock(`[${team}] could not be found!`) }
  if (!/^[0-9]+$/.test(id)) return codeBlock(`[ID must be a number!]`);
  sql = `DELETE FROM \`${team}\` WHERE \`ID\` = ${id}`;
  let result = await query(sql);
  if (result.affectedRows == 0) return codeBlock(`[match ID ${id} could not be found!]`);
  updateschedules();
  return codeBlock(`Removed match ${id} from ${team}.`)
}

const addPerm = async (command,perm) => {
  let cmds = fs.readFileSync('./commands.json');
  cmds = JSON.parse(cmds);
  try { cmds[command].permission.push(perm) } catch(err) { return codeBlock("[Command does not exist!]") };
  cmds = JSON.stringify(cmds,null,2)
  fs.writeFileSync('./commands.json',cmds);
  return codeBlock("Perm has been changed!");
}

const removePerm = async (command,perm) => {
  let cmds = fs.readFileSync('./commands.json');
  cmds = JSON.parse(cmds);
  try { var perms = cmds[command].permission } catch(err) {return codeBlock("[Command does not exist!]")};
  if (!perms.includes(perm)) return codeBlock("[Permission does not exist!]");
  perms.splice(perms.indexOf(perm));
  cmds = JSON.stringify(cmds,null,2)
  fs.writeFileSync('./commands.json',cmds);
  return codeBlock("Perm has been removed!");
}

const embed = (title,image,description) => {
  const embed = new Discord.RichEmbed()
  .setAuthor(title)
  .setColor("#ff0000")
  .setThumbnail(image)
  .setDescription(description)
  return embed;
}

let symbolAlert = 'https://i.imgur.com/JZZmdDE.png';
let symbolInfo = 'https://i.imgur.com/kVuDOTl.png';

const cget = (msg,cmd, functionallity) => {
  let commands = requireNew('./commands.json');
  const args = msg.content.toLowerCase().slice(config.prefix.length).split(' ');
  if(msg.content[0] == "!" && msg.content.length > 1) {
    let userCMD = args.shift().toLowerCase()
    if (userCMD != cmd) {
      return false;
    }
    else if (!msg.member.roles.some(role => commands[cmd].permission.some(perm => role.name.toLowerCase().includes(perm)) )) {
      let permFormat = commands[cmd].permission.map(i => '``' + i + '``').join(" or ");
      msg.reply(embed("Permission Denied!",symbolAlert,`**!**${userCMD} is restricted to ${permFormat}`))
      return true;
    }
    else if (args.length != commands[cmd].arguments.length) {
      let cmdFormat = commands[cmd].arguments.map(i => '``' + i + '``').join(" ");
      msg.reply(embed("Argument Error!",symbolAlert,`__Structure:__\n**!**${userCMD} ${cmdFormat}`))
      // msg.reply(`[Incorrect command arguments] Try: **!${userCMD}** ${cmdFormat})}`);
      return true;
    } else { 
      console.log(`${msg.member.user.tag}`.inverse + ` typed the command ` + `${userCMD}`.inverse + ` with ` + `${args.join(",")}`.inverse)
      functionallity(args);
    }  
  }
}

const command = async (m) => {
  function send(message) { m.reply(message); }
  if (cget(m,"scrim-info", async (args) => { send( await getDay(...args)); })) return;
  if (cget(m,"scrim-add", async (args) => { send( await scrimAdd(...args)); })) return;
  if (cget(m,"scrim-remove", async (args) => { send( await scrimRemove(...args)); })) return;
  if (cget(m,"help", async (args) => { send( help(m)); })) return;
  if (cget(m,"info", async (args) => { send( info()); })) return;
  if (cget(m,"graphic", async (args) => { 
    let render = await m.reply(embed("Rendering Graphic...",symbolInfo,`This will take a few seconds\n__Template:__ **${args[0]}**\n__Setting:__ **${args[1]}**`));
    m.reply(await makeGraphic(...args));
    render.delete();
  })) return;
  if (cget(m,"team-edit", async (args) => { send(await editTable(...args)); })) return;
  if (cget(m,"team-add", async (args) => { send(await addtable(...args)); })) return;
  if (cget(m,"team-remove", async (args) => { send(await removetable(...args)); })) return;
  if (cget(m,"team-list", async (args) => { send(await teamlist()); })) return;
  if (cget(m,"schedule", async (args) => { send(await getWeek(...args)); })) return;
  if (cget(m,"perm-add", async (args) => { send(await addPerm(...args)); })) return;
  if (cget(m,"perm-remove", async (args) => { send(await removePerm(...args)); })) return;
  if (cget(m,"refresh", async (args) => { await updateschedules() }))return;
}

client.on('message', async msg => {
  command(msg).catch((err) => msg.channel.send(codeBlock(`Error Occured, Report to #RDPolarity#5006\n [${err}]`)));
});

if (debug) { client.login(config.debug); }
else { client.login(config.token); }
