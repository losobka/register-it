#!/usr/bin/env node

import sade from 'sade'
import RegisterIt, { type ExistingDnsRecord } from './register.it.js'
import kleur from 'kleur';
import Enquirer from 'enquirer'
import pkg from "../package.json"
import process from 'node:process';

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
    .version(pkg.version)
    .option('--username, -u')
    .option('--password, -p')
    .option('--domain, -d')
    .option('--max-login-attempts', '', 10)
    .option('--debug, -D', 'Displays debug messages', (process.env.NODE_ENV || 'production') === 'development')
    .option('--headless, -H', 'Hides browser window', true)

program
    .command('list', 'List all DNS records', { alias: ['list-dns-records', 'list-dns', 'list-records'], default: true })
    .example('list')
    .action(async (opts: string[]) => {
        const registerIt: RegisterIt = new RegisterIt(
            opts['username'] || (await enquirer.prompt({type: 'input', name: 'username', message: 'What is the username?'}) as InputPropsUsername).username,
            opts['password'] || (await enquirer.prompt({type: 'password', name: 'password', message: 'What is the password?'}) as InputPropsPassword).password,
            opts['domain'] || (await enquirer.prompt({type: 'input', name: 'domain', message: 'What is the domain?'}) as InputPropsDomain).domain,
            Number(opts['max-login-attempts']),
            opts['headless'],
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
            Number(opts['max-login-attempts']),
            opts['headless']
        );

        const dnsRecord: ExistingDnsRecord = await registerIt.addDnsRecord({ name: name, ttl: Number(ttl), type: type, value: value })
            .finally(() => registerIt.closeConnection());

        console.log(`${kleur.bold(kleur.dim(dnsRecord.id))} ${dnsRecord.name} ${kleur.dim(dnsRecord.ttl)} ${dnsRecord.type} ${kleur.dim(dnsRecord.value)}`)
    });

program
    .command('update <id> <name> <ttl> <type> <value>', 'Edit DNS record', { alias: ['update-dns-record', 'update-dns']})
    .example('update 10 test.example.com 600 CNAME example.com')
    .action(async (id: number, name: string, ttl: number, type: string, value: string, opts: string[]) => {
        const registerIt: RegisterIt = new RegisterIt(
            opts['username'] || (await enquirer.prompt({type: 'input', name: 'username', message: 'What is the username?'}) as InputPropsUsername).username,
            opts['password'] || (await enquirer.prompt({type: 'password', name: 'password', message: 'What is the password?'}) as InputPropsPassword).password,
            opts['domain'] || (await enquirer.prompt({type: 'input', name: 'domain', message: 'What is the domain?'}) as InputPropsDomain).domain,
            Number(opts['max-login-attempts']),
            opts['headless']
        );

        const dnsRecords: ExistingDnsRecord[] = await registerIt.getDnsRecords();
        const dnsRecord: undefined | ExistingDnsRecord = dnsRecords.filter(dnsRecord => (dnsRecord as ExistingDnsRecord).id === Number(id)).pop() as ExistingDnsRecord;

        if (typeof dnsRecord === 'undefined')
            console.error('DNS record not found');

        const updatedDnsRecord: ExistingDnsRecord = await registerIt.updateDnsRecord(Number(id), { name: name || dnsRecord.name, ttl: Number(ttl) || dnsRecord.ttl, type: type || dnsRecord.type, value: value || dnsRecord.value })
            .finally(() => registerIt.closeConnection());

        console.log(`${kleur.bold(kleur.dim(updatedDnsRecord.id))} ${updatedDnsRecord.name} ${kleur.dim(updatedDnsRecord.ttl)} ${updatedDnsRecord.type} ${kleur.dim(updatedDnsRecord.value)}`)
    });

program
    .command('delete <id>', 'Delete DNS record', { alias: ['delete-dns-record', 'delete-dns']})
    .option('--no-confirm')
    .example('delete 10 --no-confirm')
    .action(async (id: string, opts: string[]) => {
        const registerIt: RegisterIt = new RegisterIt(
            opts['username'] || (await enquirer.prompt({type: 'input', name: 'username', message: 'What is the username?'}) as InputPropsUsername).username,
            opts['password'] || (await enquirer.prompt({type: 'password', name: 'password', message: 'What is the password?'}) as InputPropsPassword).password,
            opts['domain'] || (await enquirer.prompt({type: 'input', name: 'domain', message: 'What is the domain?'}) as InputPropsDomain).domain,
            Number(opts['max-login-attempts']),
            opts['headless']
        );

        if (undefined === opts['confirm']) {
            if(false === (await enquirer.prompt({type: 'confirm', name: 'delete', message: 'Are yoy sure you want to delete it?'}) as any).delete)
                return;
        }

        try {
            await registerIt.removeDnsRecord(Number(id))
                .finally(() => registerIt.closeConnection());
        } catch (err) {
            console.error(String(err));
        }
    });

program.parse(process.argv, { lazy: false })