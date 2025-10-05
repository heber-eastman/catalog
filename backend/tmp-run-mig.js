(async()=>{
  const Sequelize = require("sequelize");
  const cfg = require("./config/database");
  const url = cfg.development.url;
  const sequelize = new Sequelize(url,{logging:false});
  const qi = sequelize.getQueryInterface();
  const mig = require("./migrations/20250908090000-create-templates-seasons-overrides");
  try{
    await mig.up(qi, Sequelize);
    console.log("Migration applied");
  }catch(e){
    console.error("Migration failed", e && (e.parent?.message || e.message));
  }finally{
    await sequelize.close();
  }
})();
