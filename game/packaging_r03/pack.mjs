import {pathToFileURL} from 'node:url';
const {packager}=await import(pathToFileURL(process.env.R03_SOURCE+'/game/desktop/node_modules/@electron/packager/dist/index.js'));
const {downloadArtifact}=await import(pathToFileURL(process.env.R03_SOURCE+'/game/desktop/node_modules/@electron/packager/node_modules/@electron/get/dist/index.js'));
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const out=path.resolve(process.argv[2]);
const version='44.3.0', mirrorOptions={mirror:'https://github.com/electron/electron/releases/download/'};
// Explicit official source and checksum validation also apply to cached archives.
const download={mirrorOptions,unsafelyDisableChecksums:false};
const archive=await downloadArtifact({...download,version,artifactName:'electron',platform:process.platform,arch:process.arch});
const checksumFile=await downloadArtifact({...download,version,artifactName:'SHASUMS256.txt',isGeneric:true,cacheMode:3});
const checksums=await fs.readFile(checksumFile,'utf8');
const hash=createHash('sha256').update(await fs.readFile(archive)).digest('hex');
if(!checksums.split('\n').some(line=>line.trim().split(/\s+/).map(s=>s.replace(/^\*/,'' )).join(' ')===`${hash} ${path.basename(archive)}`))throw new Error('OFFICIAL_ELECTRON_CHECKSUM_MISMATCH');
await fs.writeFile(path.join(out,'evidence/electron-download.json'),JSON.stringify({version,archive:path.basename(archive),sha256:hash,source:`${mirrorOptions.mirror}v${version}/${path.basename(archive)}`,checksumSource:`${mirrorOptions.mirror}v${version}/SHASUMS256.txt`},null,2)+'\n');
await fs.writeFile(path.join(out,'evidence/electron-SHASUMS256.txt'),checksums);
const applications=await packager({dir:path.join(out,'stage'),out:path.join(out,'packaged'),
  name:'DeiDei R03 Diagnostic',executableName:'DeiDeiR03',appBundleId:'cn.kalopsia.deidei.r03.diagnostic',
  electronVersion:version,platform:process.platform,arch:process.arch,asar:false,prune:false,
  extraResource:[path.join(out,'frozen/worker')],download,
  ...(process.platform==='darwin'?{osxSign:{identity:'-',identityValidation:false,
    preAutoEntitlements:false,preEmbedProvisioningProfile:false,
    ignore:file=>file.includes('/Resources/worker/'),
    optionsForFile:()=>({hardenedRuntime:false,timestamp:'none'})}}:{})});
if(applications.length!==1)throw new Error('EXPECTED_ONE_NATIVE_APPLICATION');
await fs.writeFile(path.join(out,'application-path.txt'),applications[0]);
