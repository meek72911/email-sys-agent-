import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
function encryptionKey(encoded:string):Buffer{
 if(!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw Error('Credential encryption key must be a base64-encoded 32-byte key');
 const key=Buffer.from(encoded,'base64');if(key.length!==32||key.toString('base64')!==encoded)throw Error('Invalid credential encryption key');return key;
}
/** Authenticated encryption; context binds ciphertext to its workspace, user and purpose. */
export function seal(value:unknown,encodedKey:string,context:string):string{
 if(!context||context.length>500)throw Error('Invalid encryption context');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(encodedKey),iv);cipher.setAAD(Buffer.from(context,'utf8'));
 const plain=JSON.stringify(value);if(!plain||Buffer.byteLength(plain)>16384)throw Error('Invalid encrypted value');
 const ciphertext=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
export function unseal(envelope:string,encodedKey:string,context:string):unknown{
 if(!context||context.length>500||envelope.length>25000)throw Error('Invalid encrypted value');
 const parts=envelope.split('.');if(parts.length!==4||parts[0]!=='v1'||parts.slice(1).some(part=>!/^[A-Za-z0-9_-]+$/.test(part)))throw Error('Invalid encrypted value');
 const iv=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[2],'base64url'),ciphertext=Buffer.from(parts[3],'base64url');
 if(iv.length!==12||tag.length!==16||!ciphertext.length)throw Error('Invalid encrypted value');
 try{const decipher=createDecipheriv('aes-256-gcm',encryptionKey(encodedKey),iv);decipher.setAAD(Buffer.from(context,'utf8'));decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8'));}
 catch{throw Error('Could not decrypt credential');}
}
