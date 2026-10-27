const DEFAULTS = [
  {name:"Blue",value:"blue",key:"4",hex:"#0000ff"},
  {name:"Gold",value:"gold",key:"5",hex:"#ffd700"},
  {name:"Purple",value:"purple",key:"6",hex:"#800080"},
  {name:"Green",value:"green",key:"2",hex:"#008000"},
  {name:"Orange",value:"orange",key:"3",hex:"#ff8c00"},
  {name:"Red",value:"red",key:"1",hex:"#ff0000"}
];
let enabled = DEFAULTS.map(c=>c.value);
let preferredHex = "#4169e1";
let effectiveHex = "#4169e1";
const picker=document.getElementById("picker");
const hex=document.getElementById("hex");
const colors=document.getElementById("colors");
const customColorPresets=document.getElementById("customColorPresets");
const status=document.getElementById("status");
const keybindsEl=document.getElementById("keybinds");
let keybinds={};
const blacklistEnabled=document.getElementById("blacklistEnabled");
const blacklistSource=document.getElementById("blacklistSource");
const blacklistReplacement=document.getElementById("blacklistReplacement");
const blacklistSourceHex=document.getElementById("blacklistSourceHex");
const blacklistReplacementHex=document.getElementById("blacklistReplacementHex");
const say=m=>status.textContent=m;

function resolveEffectiveHex(){
  const conflicts=new Set(DEFAULTS.filter(c=>enabled.includes(c.value)).map(c=>c.hex.toLowerCase()));
  const wanted=preferredHex.toLowerCase();
  if(!conflicts.has(wanted)) return preferredHex;
  // Keep the user's chosen color as the preference, but use a temporary color
  // from the Allowed Colors palette while a matching Allowed Color is enabled.
  // The fallback must differ from the preferred color; it may match another
  // palette entry even when that color is enabled.
  const fallback=DEFAULTS.map(c=>c.hex).find(c=>c.toLowerCase()!==wanted);
  return fallback || preferredHex;
}
async function save(){
  effectiveHex=resolveEffectiveHex();
  await chrome.storage.local.set({pendingEnabledColors:enabled,pendingSelectedHex:preferredHex,pendingEffectiveSelectedHex:effectiveHex});
}
async function send(message){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!tab.url?.startsWith("https://www.online-dice.com/roll-color-dice/"))
    return {ok:false,error:"Open the Online-Dice color dice page first."};
  try{
    return await chrome.tabs.sendMessage(tab.id,message)||{ok:false,error:"No response from page."};
  }catch{
    return {ok:false,error:"Reload the dice page and reopen this popup."};
  }
}
function render(){
  colors.replaceChildren();
  customColorPresets.replaceChildren();
  keybindsEl.replaceChildren();
  DEFAULTS.forEach(c=>{
    const preset=document.createElement("button");
    preset.type="button";
    preset.className="color-option custom-preset"+(preferredHex.toLowerCase()===c.hex.toLowerCase()?" active":"");
    preset.title=`Use ${c.name} (${c.hex})`;
    preset.setAttribute("aria-label",`Set custom color to ${c.name} ${c.hex}`);
    const presetSwatch=document.createElement("span");
    presetSwatch.className="swatch";presetSwatch.style.backgroundColor=c.hex;
    const presetName=document.createElement("span");presetName.textContent=c.name;
    preset.append(presetSwatch,presetName);
    preset.addEventListener("click",async()=>{
      preferredHex=c.hex;
      picker.value=c.hex;
      await save();
      hex.textContent=effectiveHex.toUpperCase();
      render();
      say(`Custom color saved. Refresh the dice page to apply it.`);
    });
    customColorPresets.append(preset);
  });
  DEFAULTS.forEach(c=>{
    const row=document.createElement("div");row.className="keybind-row";
    const name=document.createElement("div");name.className="keybind-name";
    const sw=document.createElement("span");sw.className="swatch";sw.style.backgroundColor=c.hex;
    const label=document.createElement("span");label.textContent=c.name;
    name.append(sw,label);
    const input=document.createElement("input");input.className="keybind-input";input.type="text";input.maxLength=1;input.autocomplete="off";input.spellcheck=false;input.setAttribute("aria-label",`${c.name} keybind`);input.placeholder="None";input.value=keybinds[c.value]||"";
    input.addEventListener("input",()=>{input.value=input.value.slice(-1);});
    row.append(name,input);keybindsEl.append(row);
  });
  DEFAULTS.forEach(c=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="color-option"+(enabled.includes(c.value)?" active":"");
    b.setAttribute("aria-pressed",String(enabled.includes(c.value)));
    const sw=document.createElement("span");
    sw.className="swatch";sw.style.backgroundColor=c.hex;
    const name=document.createElement("span");name.textContent=c.name;
    const state=document.createElement("span");state.className="key";state.textContent=enabled.includes(c.value)?"Enabled":"Disabled";
    b.append(sw,name,state);
    b.addEventListener("click",async()=>{
      enabled=enabled.includes(c.value)?enabled.filter(x=>x!==c.value):[...enabled,c.value];
      await save();render();
      say("Saved. Refresh the dice page to apply color changes.");
    });
    colors.append(b);
  });
}
picker.addEventListener("input",()=>{preferredHex=picker.value;effectiveHex=resolveEffectiveHex();hex.textContent=effectiveHex.toUpperCase();render();});
picker.addEventListener("change",async()=>{preferredHex=picker.value;await save();hex.textContent=effectiveHex.toUpperCase();render();});
document.getElementById("apply").addEventListener("click",async()=>{
  await save();
  const r=await send({type:"APPLY_COLOR",color:effectiveHex});
  say(r.ok?`Applied to ${r.count} dice icon(s). (Refresh to apply queued color settings.)`:r.error);
});
document.getElementById("applyBlacklist").addEventListener("click",async()=>{
  const rule={type:"SET_COLOR_BLACKLIST",enabled:blacklistEnabled.checked,source:blacklistSource.value,replacement:blacklistReplacement.value};
  await chrome.storage.local.set({blacklistEnabled:rule.enabled,blacklistSource:rule.source,blacklistReplacement:rule.replacement});
  const r=await send(rule);
  say(r.ok?(rule.enabled?`Blacklist rule applied to visible dice (${r.count} checked).`:"Blacklist rule saved but disabled."):r.error);
});
blacklistSource.addEventListener("input",()=>blacklistSourceHex.textContent=blacklistSource.value.toUpperCase());
blacklistReplacement.addEventListener("input",()=>blacklistReplacementHex.textContent=blacklistReplacement.value.toUpperCase());
document.getElementById("reset").addEventListener("click",async()=>{
  enabled=DEFAULTS.map(c=>c.value);await save();render();
  blacklistEnabled.checked=false;
  blacklistSource.value="#800080";blacklistReplacement.value="#ffa500";
  blacklistSourceHex.textContent="#800080";blacklistReplacementHex.textContent="#FFA500";
  await chrome.storage.local.set({blacklistEnabled:false,blacklistSource:blacklistSource.value,blacklistReplacement:blacklistReplacement.value});
  say("Defaults saved. Refresh the dice page to apply color changes.");
});
(async()=>{
  try{
    const s=await chrome.storage.local.get(["enabledColors","pendingEnabledColors","selectedHex","pendingSelectedHex","blacklistEnabled","blacklistSource","blacklistReplacement","keybinds"]);
    const savedColors=Array.isArray(s.pendingEnabledColors)?s.pendingEnabledColors:s.enabledColors;
    if(Array.isArray(savedColors))enabled=DEFAULTS.map(c=>c.value).filter(c=>savedColors.includes(c));
    const startupHex=typeof s.pendingSelectedHex==="string"&&/^#[0-9a-f]{6}$/i.test(s.pendingSelectedHex)?s.pendingSelectedHex:s.selectedHex;
    if(typeof startupHex==="string"&&/^#[0-9a-f]{6}$/i.test(startupHex)){preferredHex=startupHex;picker.value=startupHex;}
    if(s.keybinds&&typeof s.keybinds==="object"&&!Array.isArray(s.keybinds))keybinds=s.keybinds;
    if(typeof s.blacklistEnabled==="boolean")blacklistEnabled.checked=s.blacklistEnabled;
    if(typeof s.blacklistSource==="string"&&/^#[0-9a-f]{6}$/i.test(s.blacklistSource))blacklistSource.value=s.blacklistSource;
    if(typeof s.blacklistReplacement==="string"&&/^#[0-9a-f]{6}$/i.test(s.blacklistReplacement))blacklistReplacement.value=s.blacklistReplacement;
    effectiveHex=resolveEffectiveHex();
    hex.textContent=effectiveHex.toUpperCase();
    // Keep the computed color queued; the page content script activates it on refresh.
    blacklistSourceHex.textContent=blacklistSource.value.toUpperCase();
    blacklistReplacementHex.textContent=blacklistReplacement.value.toUpperCase();render();
  }catch{say("Could not load preferences.");}
})();

document.getElementById("downloadLog").addEventListener("click",async()=>{
  try{
    const data=await chrome.storage.local.get({zIndexLog:[]});
    const entries=Array.isArray(data.zIndexLog)?data.zIndexLog:[];
    const lines=["Hollow Hub - higher z-index detections", "", ...entries.map(e=>`${e.time} | covering z-index: ${e.coveringZIndex} | dice box z-index: ${e.diceBoxZIndex} | element: <${e.coveringElement}${e.id?` id=\"${e.id}\"`:""}${e.className?` class=\"${e.className}\"`:""}>`)];
    const blob=new Blob([lines.join("\n")+"\n"],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="log.txt";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    say(`Downloaded log.txt (${entries.length} detection(s)).`);
  }catch{say("Could not export the z-index log.");}
});


document.getElementById("saveKeybinds").addEventListener("click",async()=>{
  const next={};
  const used=new Map();
  const inputs=[...keybindsEl.querySelectorAll("input")];
  for(let i=0;i<DEFAULTS.length;i++){
    const raw=inputs[i].value.trim();
    if(!raw)continue;
    const key=raw.toLowerCase();
    if(used.has(key)){say(`Key “${raw}” is assigned to both ${used.get(key)} and ${DEFAULTS[i].name}. Use unique keys.`);return;}
    used.set(key,DEFAULTS[i].name);next[DEFAULTS[i].value]=raw;
  }
  keybinds=next;
  await chrome.storage.local.set({keybinds});
  say("Keybinds saved. Color toggles from keybinds will apply after the dice page refreshes.");
});
