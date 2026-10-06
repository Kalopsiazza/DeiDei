// Real updater transport fixture. It never calls quitAndInstall or claims native installation.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const out=path.resolve(process.argv[2]||path.join(root,'.local-outputs/R05-T01-a/update-transport'));
fs.mkdirSync(out,{recursive:true});
const fixture=path.join(out,'application');fs.mkdirSync(fixture,{recursive:true});
fs.writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'deidei-update-fixture',productName:'DeiDei Update Fixture',version:'0.4.0-beta.1',main:path.join(__dirname,'update-fixture.cjs')}));
const environment={...process.env,DEIDEI_UPDATE_EVIDENCE:out};delete environment.ELECTRON_RUN_AS_NODE;
const executable=require('../desktop/node_modules/electron');
const result=spawnSync(executable,[fixture],{env:environment,encoding:'utf8',timeout:120_000});
fs.writeFileSync(path.join(out,'process.json'),JSON.stringify({executable,exit_code:result.status,error:result.error?.message,stdout:result.stdout,stderr:result.stderr,evidence_kind:'real electron-updater 6.8.10 HTTP transport; native_install NOT_RUN'},null,2)+'\n');
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');process.exitCode=result.status??1;
