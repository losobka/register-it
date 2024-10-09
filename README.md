# @losobka/register.it
Node.js SDK and CLI client for [register.it](https://www.register.it)

# Installation
Using NPM:
```shell
npm install -g @losobka/register.it
```

# Usage examples
## SDK
```ts
import RegisterIt from '@losobka/register-it'

const registerIt: RegisterIt = new RegisterIt(
    'your@username.email',
    'type-password-here',
    'losobka.me',
    10,
    {trace: (...messages) => console.debug(...messages)})
);

console.log(await registerIt.getDnsRecords())

console.log(await registerIt.addDnsRecord({
    name: 'example.losobka.me',
    ttl: 600,
    type: 'A',
    value: '83.25.152.179'
}) as DnsRecord)

console.log(await registerIt.updateDnsRecord(12, {
    name: 'example-2.losobka.me',
    ttl: 600,
    type: 'A',
    value: '83.25.152.179'
} as DnsRecord))

console.log(await registerIt.deleteDnsRecord(12))

await registerIt.closeConnection()
````

## CLI
```shell
register.it-cli list -h
>   Description
>     List all DNS records
> 
>   Usage
>     $ register.it-cli list [options]
> 
>   Aliases
>     $ register.it-cli list-dns
>     $ register.it-cli list-records
>     $ register.it-cli list-dns-records
> 
>   Options
>     -u, --username          
>     -p, --password          
>     -d, --domain            
>     --max-login-attempts      (default 10)
>     -D, --debug             Displays debug messages  (default false)
>     -H, --headless          Hides browser window  (default true)
>     -h, --help              Displays this message
> 
>   Examples
>     $ register.it-cli list

register.it-cli list
> ✔ What is the username? · losobka
> ✔ What is the password? · **************
> ✔ What is the domain? · losobka.me
> 1 losobka.me. 900 MX 10 mail.register.it.
> 2 authsmtp.losobka.me. 900 CNAME authsmtp.register.it.
> 3 ftp.losobka.me. 900 CNAME losobka.me.
> 4 pop.losobka.me. 900 CNAME mail.register.it.
> 5 www.losobka.me. 900 CNAME losobka.me.
> 6 pec.losobka.me. 900 MX 10 server.pec-email.com.
> 7 losobka.me. 900 TXT "v=spf1 include:spf.webapps.net ~all"
> 8 autoconfig.losobka.me. 900 CNAME tb-it.securemail.pro.
> 9 _autodiscover._tcp.losobka.me. 900 SRV 10 10 443 ms-it.securemail.pro.
> 10 pec.losobka.me. 900 TXT "v=spf1 include:spf.pec-email.com ~all"
> 11 oci.losobka.me. 600 CNAME losobka.me.
> 12 portainer.losobka.me. 600 CNAME losobka.me.

register.it-cli create example.losobka.me 600 A 83.25.152.179
> ✔ What is the username? · losobka
> ✔ What is the password? · **************
> ✔ What is the domain? · losobka.me

register.it-cli update -h
>   Description
>     Edit DNS record
> 
>   Usage
>     $ register.it-cli update <id> <name> <ttl> <type> <value> [options]
> 
>   Aliases
>     $ register.it-cli update-dns
>     $ register.it-cli update-dns-record
> 
>   Options
>     -u, --username          
>     -p, --password          
>     -d, --domain            
>     --max-login-attempts      (default 10)
>     -D, --debug             Displays debug messages  (default false)
>     -H, --headless          Hides browser window  (default true)
>     -h, --help              Displays this message
> 
>   Examples
>     $ register.it-cli update 10 test.example.com 600 CNAME example.com

register.it-cli update 12 example-2.losobka.me 600 A 83.25.152.190
> ✔ What is the username? · losobka
> ✔ What is the password? · **************
> ✔ What is the domain? · losobka.me

register.it-cli delete -h
> Description
>    Delete DNS record
>
>  Usage
>    $ register.it-cli delete <id> [options]
>
>  Aliases
>    $ register.it-cli delete-dns
>    $ register.it-cli delete-dns-record
>
>  Options
>    --no-confirm
>    -u, --username          
>    -p, --password          
>    -d, --domain            
>    --max-login-attempts      (default 10)
>    -D, --debug             Displays debug messages  (default false)
>     -H, --headless         Hides browser window  (default true)
>    -h, --help              Displays this message
>
>  Examples
>    $ register.it-cli delete 10 --no-confirm

register.it-cli delete 13 --no-confirm
> ✔ What is the username? · losobka
> ✔ What is the password? · **************
> ✔ What is the domain? · losobka.me

```

# Licence
The application is available as open source under the terms of the MIT License.