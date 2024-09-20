# Installation
Using NPM:
```shell
npm install @losobka/register-it
```

# Usage

```ts
import RegisterIt from '@losobka/register-it'
const registerIt: RegisterIt = new RegisterIt('your@username.email', 'type-password-here', 'losobka.me', 10, { trace: (...messages) => console.debug(...messages)})

console.log(await registerIt.getDnsRecords())
console.log(await registerIt.addDnsRecord({ name: 'example`.losobka.me', ttl: 600, type: 'A', value: '83.25.152.179'}) as DnsRecord)
console.log(await registerIt.updateDnsRecord(12, { name: 'example-2.losobka.me', ttl: 600, type: 'A', value: '83.25.152.179'}) as DnsRecord)
await registerIt.closeConnection()
````