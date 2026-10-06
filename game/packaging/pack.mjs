import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(new URL('../desktop/package.json',import.meta.url));
const {build,Platform,Arch}=require('electron-builder');
const {downloadArtifact,ElectronDownloadCacheMode}=await import(require.resolve('@electron/get'));
const out=path.resolve(process.argv[2]);
const plan=JSON.parse(await fs.readFile(path.join(out,'package-plan.json'),'utf8'));
const stage=path.join(out,'stage');
const packageInfo=JSON.parse(await fs.readFile(path.join(stage,'package.json'),'utf8'));
const version=JSON.parse(await fs.readFile(new URL('../desktop/package.json',import.meta.url),'utf8')).devDependencies.electron;
const mirrorOptions={mirror:'https://github.com/electron/electron/releases/download/'};
const download={mirrorOptions,unsafelyDisableChecksums:false};
const archive=await downloadArtifact({...download,version,artifactName:'electron',platform:process.platform,arch:process.arch});
const checksumFile=await downloadArtifact({...download,version,artifactName:'SHASUMS256.txt',isGeneric:true,cacheMode:ElectronDownloadCacheMode.Bypass});
const checksums=await fs.readFile(checksumFile,'utf8');
const hash=createHash('sha256').update(await fs.readFile(archive)).digest('hex');
if(!checksums.split('\n').some(line=>line.trim().split(/\s+/).map(value=>value.replace(/^\*/,'' )).join(' ')===`${hash} ${path.basename(archive)}`))throw new Error('OFFICIAL_ELECTRON_CHECKSUM_MISMATCH');
await fs.writeFile(path.join(out,'evidence/electron-download.json'),JSON.stringify({version,archive:path.basename(archive),sha256:hash,source:`${mirrorOptions.mirror}v${version}/${path.basename(archive)}`},null,2)+'\n');
const update=JSON.parse(await fs.readFile(path.join(out,'update-config.json'),'utf8'));
const publish=update.mode==='fixture'?{provider:'generic',url:update.url}:{provider:'github',owner:update.owner,repo:update.repo,private:false};
const production=plan.mode==='production';
if(production&&process.platform==='darwin'){
  const identities=execFileSync('security',['find-identity','-v','-p','codesigning'],{encoding:'utf8'});
  if(!identities.includes('Developer ID Application'))throw new Error('PRODUCTION_SIGNING_IDENTITY_REQUIRED');
  if(!process.env.APPLE_KEYCHAIN_PROFILE&&!process.env.APPLE_API_KEY&&!process.env.APPLE_ID)throw new Error('PRODUCTION_NOTARIZATION_REQUIRED');
}
if(production&&process.platform==='win32'&&!process.env.WIN_CSC_LINK&&!process.env.CSC_LINK)throw new Error('PRODUCTION_SIGNING_IDENTITY_REQUIRED');
const configuration={
  appId:plan.appId,productName:packageInfo.productName,executableName:plan.executableName,
  electronVersion:version,electronDist:archive,asar:false,npmRebuild:false,forceCodeSigning:production||Boolean(plan.fixtureSigningIdentity),
  directories:{app:stage,output:path.join(out,'packaged')},files:['**/*','!package-lock.json'],
  extraResources:[...plan.resources.map(item=>({from:path.join(out,item.from),to:item.to,filter:['**/*']})),...['update-config.json','telemetry-config.json','PLAYER-README.txt'].map(name=>({from:path.join(out,name),to:name}))],
  artifactName:'DeiDei-${version}-${os}-${arch}.${ext}',publish,generateUpdatesFilesForAllChannels:true,
  mac:{target:['dmg','zip'],identity:production?undefined:plan.fixtureSigningIdentity||'-',hardenedRuntime:production||Boolean(plan.fixtureSigningIdentity),notarize:production,strictVerify:true,preAutoEntitlements:false,binaries:plan.macBinaries||[]},
  win:{target:['nsis'],publisherName:plan.publisherName||undefined},nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,differentialPackage:false},
};
const target=process.platform==='darwin'?Platform.MAC:Platform.WINDOWS;
await build({projectDir:fileURLToPath(new URL('../desktop',import.meta.url)),targets:target.createTarget(undefined,process.arch==='arm64'?Arch.arm64:Arch.x64),config:configuration,publish:'never'});
const applications=await fs.readdir(path.join(out,'packaged'),{withFileTypes:true});
const appDirectory=applications.find(item=>item.isDirectory()&&(process.platform==='darwin'?item.name.startsWith('mac'):item.name==='win-unpacked'));
if(!appDirectory)throw new Error('PACKAGED_APPLICATION_MISSING');
let application=path.join(out,'packaged',appDirectory.name);
if(process.platform==='darwin') {
  const bundles=(await fs.readdir(application)).filter(name=>name.endsWith('.app'));
  if(bundles.length!==1)throw new Error('EXPECTED_ONE_NATIVE_APPLICATION');
  application=path.join(application,bundles[0]);
}
await fs.writeFile(path.join(out,'application-path.txt'),application);
