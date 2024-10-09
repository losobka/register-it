import sade from 'sade'
import RegisterIt, { type ExistingDnsRecord } from './register.it.js'
import kleur from 'kleur';
import Enquirer from 'enquirer'

const program: sade.Sade = sade('register.it-cli');
const enquirer: Enquirer = new Enquirer();

interface InputPropsUsername {
    username: string;
}

interface InputPropsPassword {
    password: string;
}

interface InputPropsDomain {
    domain: string;
}

program
    .version('1.1.3')
    .option('--username, -u')
    .option('--password, -p')
    .option('--domain, -d')
    .option('--max-login-attempts', '', 10)
    .option('--debug, -D', 'Displays debug messages', (process.env.NODE_ENV || 'development') === 'development')

program
    .command('list', 'List all DNS records', { alias: ['list-dns-records', 'list-dns', 'list-records']})
    .example('list')
    .action(async (opts: string[]) => {
        const registerIt: RegisterIt = new RegisterIt(
            opts['username'] || (await enquirer.prompt({type: 'input', name: 'username', message: 'What is the username?'}) as InputPropsUsername).username,
            opts['password'] || (await enquirer.prompt({type: 'password', name: 'password', message: 'What is the password?'}) as InputPropsPassword).password,
            opts['domain'] || (await enquirer.prompt({type: 'input', name: 'domain', message: 'What is the domain?'}) as InputPropsDomain).domain,
            opts['max-login-attempts']
        );

        await registerIt.getDnsRecords()
            .then(dnsRecords => dnsRecords.forEach((value: object) => {
                    const dnsRecord: ExistingDnsRecord = value as ExistingDnsRecord;

                    console.log(`${kleur.bold(kleur.dim(dnsRecord.id))} ${dnsRecord.name} ${kleur.dim(dnsRecord.ttl)} ${dnsRecord.type} ${kleur.dim(dnsRecord.value)}`)
                })
            )
            .finally(() => registerIt.closeConnection());
    });

program
    .command('create <name> <ttl> <type> <value>', 'Create DNS record', { alias: ['create-dns-record', 'create-dns']})
    .example('create 10 test.example.com 600 CNAME example.com')
    .action(async (name: string, ttl: number, type: string, value: string, opts: string[]) => {
        const registerIt: RegisterIt = new RegisterIt(
            opts['username'] || (await enquirer.prompt({type: 'input', name: 'username', message: 'What is the username?'}) as InputPropsUsername).username,
            opts['password'] || (await enquirer.prompt({type: 'password', name: 'password', message: 'What is the password?'}) as InputPropsPassword).password,
            opts['domain'] || (await enquirer.prompt({type: 'input', name: 'domain', message: 'What is the domain?'}) as InputPropsDomain).domain,
            opts['max-login-attempts']
        );

        await registerIt.addDnsRecord({ name: name, ttl: (ttl as number), type: type, value: value })
            .finally(() => registerIt.closeConnection());
    });

program
    .command('update <id> <name> <ttl> <type> <value>', 'Edit DNS record', { alias: ['update-dns-record', 'update-dns']})
    .example('update 10 test.example.com 600 CNAME example.com')
    .action(async (id: number, name: string, ttl: number, type: string, value: string, opts: string[]) => {
        const registerIt: RegisterIt = new RegisterIt(
            opts['username'] || (await enquirer.prompt({type: 'input', name: 'username', message: 'What is the username?'}) as InputPropsUsername).username,
            opts['password'] || (await enquirer.prompt({type: 'password', name: 'password', message: 'What is the password?'}) as InputPropsPassword).password,
            opts['domain'] || (await enquirer.prompt({type: 'input', name: 'domain', message: 'What is the domain?'}) as InputPropsDomain).domain,
            opts['max-login-attempts']
        );

        const dnsReords: ExistingDnsRecord[] = await registerIt.getDnsRecords();
        const dnsRecord: undefined | ExistingDnsRecord = dnsReords.filter(dnsRecord => (dnsRecord as ExistingDnsRecord).id === id).pop() as ExistingDnsRecord;

        if (! dnsRecord)
            throw new Error('DNS record not found');

        await registerIt.updateDnsRecord(id as number, { name: name || dnsRecord.name, ttl: (ttl as number) || dnsRecord.ttl, type: type || dnsRecord.type, value: value || dnsRecord.value })
            .finally(() => registerIt.closeConnection());
    });

program
    .command('delete <id>', 'Delete DNS record', { alias: ['delete-dns-record', 'delete-dns']})
    .option('--no-confirm, -nc')
    .example('delete 10 --no-confirm')
    .action(async (id: string, opts: string[]) => {
        const registerIt: RegisterIt = new RegisterIt(
            opts['username'] || (await enquirer.prompt({type: 'input', name: 'username', message: 'What is the username?'}) as InputPropsUsername).username,
            opts['password'] || (await enquirer.prompt({type: 'password', name: 'password', message: 'What is the password?'}) as InputPropsPassword).password,
            opts['domain'] || (await enquirer.prompt({type: 'input', name: 'domain', message: 'What is the domain?'}) as InputPropsDomain).domain,
            opts['max-login-attempts']
        );

        await registerIt.removeDnsRecord(id as unknown as number)
            .finally(() => registerIt.closeConnection());
    });

program.parse(process.argv, { lazy: false });