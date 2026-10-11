// Propagate Electron's status reliably through Windows npm/PowerShell runners.
const {spawnSync}=require('child_process');
const path=require('path');
const result=spawnSync(require('electron'),[path.join(__dirname,'test-face-caption-render.cjs')],{
  cwd:path.join(__dirname,'..'),stdio:'inherit',windowsHide:true,timeout:60000
});
if(result.error)console.error(result.error.message);
process.exitCode=result.status??1;
