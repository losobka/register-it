# @losobka/register.it
Node.js library for [register.it](https://www.register.it)

# Installation
Using NPM:
```shell
npm install @losobka/register.it
```

# Usage
```ts
import RegisterIt from '@losobka/register-it'
import {Logger} from "./register.it";

const registerIt: RegisterIt = new RegisterIt('your@username.email', 'type-password-here', 'losobka.me', 10, {trace: (...messages) => console.debug(...messages)} as Logger)

console.log(await registerIt.getDnsRecords())
console.log(await registerIt.addDnsRecord({
    name: 'example`.losobka.me',
    ttl: 600,
    type: 'A',
    value: '83.25.152.179'
}) as DnsRecord)
console.log(await registerIt.updateDnsRecord(12, {
    name: 'example-2.losobka.me',
    ttl: 600,
    type: 'A',
    value: '83.25.152.179'
}) as DnsRecord)
console.log(await registerIt.deleteDnsRecord(12))
await registerIt.closeConnection()
````

# Licence
The application is available as open source under the terms of the MIT License.