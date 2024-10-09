import puppeteer, { Browser, Dialog, Page, ElementHandle, TimeoutError } from 'puppeteer';
import UserAgent from 'user-agents';
import { tmpdir } from 'node:os';

const delay = async (milliseconds: number) => new Promise((resolve) => { setTimeout(resolve, milliseconds); });
export interface DnsRecord {
    name: string;
    type: 'NS' | 'A' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'AAAA' | 'CAA' | 'ALIAS' | 'SPF' | string;
    ttl: number;
    value: string;
}

export interface Logger {
    trace(...messages);
}

export interface ExistingDnsRecord extends DnsRecord {
    readonly id: number | string;
}

export class DnsRecordNotFoundError extends Error {
    constructor() {
        super('failed: DNS record not found');
    }
}

interface FakeBrowser {
    newPage(): Page | FakePage;
    close(): unknown;
}

interface FakePage {
    close(): unknown;
    waitForNavigation(): unknown;
    waitForSelector(selector: string): any | any[] | Promise<any>;
    waitForNavigation(): unknown;
    waitForNetworkIdle(): unknown;
    $(selector: string): any | any[];
    $$(selector: string): any | any[];
    goto(url: string): any | any[] | Promise<any>;
    $$eval(selector: string, callback: any): any[] | any;
    url(): unknown;
    screenshot(): unknown;
    on(): unknown;
    exposeFunction(): unknown;
    setViewport(): unknown;
    setUserAgent(): unknown;
}

export default class RegisterIt {
    private username: string;
    private password: string;
    private domain: string;
    private browser: Browser | FakeBrowser;
    private page: Page | FakePage;
    private alreadyLoggedIn: boolean;
    private readonly maxLoginAttempts: number;
    private readonly headless: boolean;
    private readonly logger: Logger;

    public constructor(
        username: string,
        password: string,
        domain: string,
        maxLoginAttempts: number = 0,
        headless: boolean = true,
        logger: Logger = { trace: () => { } }
    ) {
        this.username = username;
        this.password = password;
        this.domain = domain;
        this.alreadyLoggedIn = false;
        this.maxLoginAttempts = maxLoginAttempts;
        this.browser = {
            newPage: () => { }
        } as FakeBrowser;
        this.page = {
            close: () => { },
            waitForSelector: (selector: string) => { },
            waitForNavigation: () => { },
            waitForNetworkIdle: () => { },
            $: () => { },
            $$: () => { },
            goto: (url: string): any => { },
            $$eval: (selector: string, callback: any): any => { },
            url: () => { },
            screenshot: () => { },
            on: () => { },
            exposeFunction: () => { },
            setViewport: () => { },
            setUserAgent: () => { }
        } as FakePage;
        this.headless = headless;
        this.logger = logger;
    }

    private async initialize(): Promise<void> {
        this.browser = await puppeteer.launch({ headless: this.headless, args: ['--no-sandbox', '--start-maximized'] });
        this.page = await this.browser.newPage();

        const logger = this.logger;

        this.page
            .on('load',  () => logger.trace(`page loaded \`${this.page.url()}\``))
            .on('dialog', async (dialog: Dialog) => {
                logger.trace('accepting dialog');

                return Promise.resolve(await dialog.accept());
            });

        await this.page.exposeFunction('confirm', () => () => {});
        await this.page.setViewport({ height: 1366, width: 900 });
        const userAgent: string = (new UserAgent)
            .random()
            .toString();
        await this.page.setUserAgent(userAgent);
        logger.trace(`setting useragent to \`${userAgent}\``);

        await this.page.goto('https://controlpanel.register.it/welcome.html');
    }

    private async closeCookiesModal(): Promise<void> {
        const cookiesRejectButtonSelector: string = 'button.iubenda-cs-reject-btn';
        const logger = this.logger;

        this.page.waitForSelector(cookiesRejectButtonSelector)
            .then(async () => this.page.$(cookiesRejectButtonSelector))
            .then(async (el: ElementHandle<Element>) => el.evaluate((el: Element) => (el as HTMLButtonElement).click()))
            .then(() => logger.trace('clicked `reject all cookies` button'));
    }

    private async login() {
        let loginAttempts: number = 0;
        let logger: Logger = this.logger;

        do {
            const loginSelector: string = 'form#formLogin input.userName';
            const passwordSelector: string = 'form#formLogin input.password';
            const loginButtonSelector: string = '.standard-login-module button.btn-primary';

            if (this.maxLoginAttempts > 0) {
                logger.trace(`performing ${loginAttempts + 1} of ${this.maxLoginAttempts} login attempt`);
                await this.page.waitForSelector(loginSelector)
                    .then(async () => this.page.$(loginSelector))
                    .then(async (el: ElementHandle<HTMLInputElement>) => el.type(this.username, { delay: 100 }))
                    .then(async () => this.page.$(passwordSelector))
                    .then(async (el: ElementHandle<HTMLInputElement>) => el.type(this.password, { delay: 100 }))
                    .then(() => logger.trace('clicking `login` button'))
                    .then(async () => await delay(1000))
                    .then(() => this.page.screenshot({ path: tmpdir + '/' + 'screenshot.jpg' }))
                    .then(async () => this.page.$(loginButtonSelector))
                    .then(async (el: ElementHandle<HTMLButtonElement>) => el.evaluate(el => el.click()))
                    .then(async () => await this.page.waitForNetworkIdle());

            }

            loginAttempts++;

            if (this.maxLoginAttempts === loginAttempts)
                throw new Error('Max login attempts reached, please try again later');

        } while (this.page.url() !== 'https://controlpanel.register.it/' && ((this.maxLoginAttempts as unknown as boolean) && loginAttempts < this.maxLoginAttempts));

        logger.trace('logged in');
        this.alreadyLoggedIn = true;
    }

    public async getDnsRecords(): Promise<ExistingDnsRecord[]> {
        const logger = this.logger;

        if (!this.alreadyLoggedIn) {
            await this.initialize();
            await this.closeCookiesModal();
            await this.login();
        }

        const domainSelector: string = 'ul.domains-list li a';
        const domainAndDnsLinkSelector: string = 'li#webapp_domain a';
        const dnsConfigurationLinkSelector: string = 'li#dom_dns a';
        const advancedTabLinkSelector: string = 'ul.tabbedMenu li.lastChild a';

        await this.page.goto(`https://controlpanel.register.it/firstLevel/view.html?domain=${this.domain}`)
            .then(async () => this.page.waitForSelector(domainSelector))
            .then(async () => this.page.$(domainSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate((el: HTMLAnchorElement) => el.click()))
            .then(() => logger.trace(`clicking \`${this.domain}\` link`))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(domainAndDnsLinkSelector))
            .then(() => logger.trace('clicking `DOMAIN & DNS` link'))
            .then(async () => this.page.$(domainAndDnsLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate((el: HTMLAnchorElement) => el.click()))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(dnsConfigurationLinkSelector))
            .then(() => logger.trace('clicking `DNS configuration` link'))
            .then(async () => this.page.$(dnsConfigurationLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate((el: HTMLAnchorElement) => el.click()))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(advancedTabLinkSelector))
            .then(() => logger.trace('clicking `Advanced` link'))
            .then(async () => this.page.$(advancedTabLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate((el: HTMLAnchorElement) => el.click()))
            .then(async () => this.page.waitForNavigation());

        const dnsNames: string[] = await this.page.$$eval('form.dnsTable table.dinamicList tbody tr.rMain input.recordName',
            (elements: HTMLInputElement[]) => {
                return elements.map((element: HTMLInputElement) => {
                    return element.value;
                });
            });

        const dnsTtls: string[] = await this.page.$$eval('form.dnsTable table.dinamicList tbody tr.rMain input.recordTTL',
            (elements: HTMLInputElement[]) => elements.map((element: HTMLInputElement) => element.value));

        const dnsTypes: string[] = await this.page.$$eval('form.dnsTable table.dinamicList tbody tr.rMain select.recordType',
            (elements: HTMLSelectElement[]) => elements.map((element: HTMLSelectElement) => element.value));

        const dnsValues: string[] = await this.page.$$eval('form.dnsTable table.dinamicList tbody tr.rMain textarea.recordValue',
            (elements: HTMLTextAreaElement[]) => elements.map((element: HTMLTextAreaElement) => element.value));

        const dnsRowsWithIds: string[] = await this.page.$$eval('form.dnsTable table.dinamicList tbody tr.rMain',
            (elements: HTMLTableRowElement[]) => elements.map((element: HTMLTableRowElement, key: number) => element.id = (key + 1).toString()));

        const dnsRecords: ExistingDnsRecord[] = [];

        for (let i: number = 0; i < dnsNames.length; i++) {
            dnsRecords.push({
                id: Number(dnsRowsWithIds[i]),
                name: dnsNames[i],
                ttl: Number(dnsTtls[i]),
                type: dnsTypes[i],
                value: dnsValues[i]
            } as ExistingDnsRecord);
        }

        return dnsRecords;
    }

    public async removeDnsRecord(id: number): Promise<void> {
        const logger = this.logger;

        if (!this.alreadyLoggedIn) {
            await this.initialize();
            await this.closeCookiesModal();
            await this.login();
        }

        const domainSelector: string = 'ul.domains-list li a';
        const domainAndDnsLinkSelector: string = 'li#webapp_domain a';
        const dnsConfigurationLinkSelector: string = 'li#dom_dns a';
        const advancedTabLinkSelector: string = 'ul.tabbedMenu li.lastChild a';
        const dnsRecordRemoveActionLinkSelector = (id: number): string => `tr[name=recordDNS_${id - 1}] td.col-actions a.recordRemove`;
        const dnsModalApplyLinkSelector: string = 'div#modalDNS a.apply';
        const dnsRecordsSubmitButtonSelector: string = 'div.console-apply a.submit';

        await this.page.goto(`https://controlpanel.register.it/firstLevel/view.html?domain=${this.domain}`)
            .then(async () => this.page.waitForSelector(domainSelector))
            .then(async () => this.page.$(domainSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => logger.trace(`clicking \`${this.domain}\` link`))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(domainAndDnsLinkSelector))
            .then(() => logger.trace('clicking `DOMAIN & DNS` link'))
            .then(async () => this.page.$(domainAndDnsLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(dnsConfigurationLinkSelector))
            .then(() => logger.trace('clicking `DNS configuration` link'))
            .then(async () => this.page.$(dnsConfigurationLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(advancedTabLinkSelector))
            .then(() => logger.trace('clicking `Advanced` link'))
            .then(async () => this.page.$(advancedTabLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation());

        try {
            await this.page.waitForSelector(dnsRecordRemoveActionLinkSelector(id), { timeout: 1000 });
        } catch (error) {
            if (error instanceof TimeoutError)
                throw new DnsRecordNotFoundError;
        }

        await this.page.waitForSelector(dnsRecordRemoveActionLinkSelector(id))
            .then(() => logger.trace('clicking `remove` link'))
            .then(async () => this.page.$(dnsRecordRemoveActionLinkSelector(id)))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(async () => await delay(1000))
            .then(() => logger.trace('clicking `apply` button'))
            .then(async () => this.page.$(dnsModalApplyLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            // .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(dnsRecordsSubmitButtonSelector))
            .then(() => logger.trace('clicking `submit` button'))
            .then(async () => this.page.$(dnsRecordsSubmitButtonSelector))
            .then(async (el: ElementHandle<HTMLButtonElement>) => el.evaluate(el => el.click()))
            .then(async () => await delay(1000))
            .then(async () => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(() => logger.trace('clicking `apply` button'))
            .then(async () => this.page.$(dnsModalApplyLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))

            .then(async () => this.page.waitForNavigation());
    }
    public async addDnsRecord(record: { name: string; ttl: string | number; type: string; value: string }): Promise<ExistingDnsRecord> {
        const logger = this.logger;

        if (!this.alreadyLoggedIn) {
            await this.initialize();
            await this.closeCookiesModal();
            await this.login();
        }

        const domainSelector: string = 'ul.domains-list li a';
        const domainAndDnsLinkSelector: string = 'li#webapp_domain a';
        const dnsConfigurationLinkSelector: string = 'li#dom_dns a';
        const advancedTabLinkSelector: string = 'ul.tabbedMenu li.lastChild a';

        const addDnsRecordButtonSelector: string = 'div.console-buttons a.add';
        const addDnsRecordNameSelector = (id: number): string => `tr[name=recordDNS_${id - 1}] input.recordName`;
        const addDnsRecordTtlSelector = (id: number): string => `tr[name=recordDNS_${id - 1}] input.recordTTL`;
        const addDnsRecordTypeSelector = (id: number): string => `tr[name=recordDNS_${id - 1}] select.recordType`;
        const addDnsRecordValueSelector = (id: number): string => `tr[name=recordDNS_${id - 1}] textarea.recordValue`;
        const dnsModalApplyLinkSelector: string = 'div#modalDNS a.apply';
        const dnsRecordsSubmitButtonSelector: string = 'div.console-apply a.submit';

        const id: number = await this.page.goto(`https://controlpanel.register.it/firstLevel/view.html?domain=${this.domain}`)
            .then(async () => this.page.waitForSelector(domainSelector))
            .then(async () => this.page.$(domainSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => logger.trace(`clicking \`${this.domain}\` link`))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(domainAndDnsLinkSelector))
            .then(() => logger.trace('clicking `DOMAIN & DNS` link'))
            .then(async () => this.page.$(domainAndDnsLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(dnsConfigurationLinkSelector))
            .then(() => logger.trace('clicking `DNS configuration` link'))
            .then(async () => this.page.$(dnsConfigurationLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(advancedTabLinkSelector))
            .then(() => logger.trace('clicking `Advanced` link'))
            .then(async () => this.page.$(advancedTabLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation())

            .then(async () => this.page.waitForSelector(addDnsRecordButtonSelector))
            .then(() => logger.trace('clicking `add` link'))
            .then(async () => this.page.$(addDnsRecordButtonSelector)
                .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
                .then(async () => this.page.$$('.rMain'))
                .then((elements: ElementHandle[]) => elements.length));

        await this.page.$(addDnsRecordNameSelector(id))
            .then(async (el: ElementHandle<HTMLInputElement>) => el.type(record.name))
            .then(async () => this.page.$(addDnsRecordTtlSelector(id)))
            .then(async (el: ElementHandle<HTMLInputElement>) => el.type(record.ttl.toString()))
            .then(async () => this.page.$(addDnsRecordTypeSelector(id)))
            .then(async (el: ElementHandle<HTMLSelectElement>) => el.type(record.type))
            .then(async () => this.page.$(addDnsRecordValueSelector(id)))
            .then(async (el: ElementHandle<HTMLInputElement>) => el.type(record.value))
            .then(async () => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(async () => await delay(1000))
            .then(() => logger.trace('clicking `apply` button'))
            .then(async () => this.page.$(dnsModalApplyLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForSelector(dnsRecordsSubmitButtonSelector))
            .then(() => logger.trace('clicking `submit` button'))
            .then(async () => this.page.$(dnsRecordsSubmitButtonSelector))
            .then(async (el: ElementHandle<HTMLButtonElement>) => el.evaluate(el => el.click()))
            .then(async () => await delay(1000))
            .then(async () => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(() => logger.trace('clicking `apply` button'))
            .then(async () => this.page.$(dnsModalApplyLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation());

        return { id, ...record } as ExistingDnsRecord;
    }

    public async updateDnsRecord(id: number, record: DnsRecord): Promise<ExistingDnsRecord> {
        const logger: Logger = this.logger;

        if (!this.alreadyLoggedIn) {
            await this.initialize();
            await this.closeCookiesModal();
            await this.login();
        }

        const domainSelector: string = 'ul.domains-list li a';
        const domainAndDnsLinkSelector: string = 'li#webapp_domain a';
        const dnsConfigurationLinkSelector: string = 'li#dom_dns a';
        const advancedTabLinkSelector: string = 'ul.tabbedMenu li.lastChild a';
        const addDnsRecordNameSelector = (id: number): string => `tr[name=recordDNS_${id - 1}] input.recordName`;
        const addDnsRecordTtlSelector = (id: number): string => `tr[name=recordDNS_${id - 1}] input.recordTTL`;
        const addDnsRecordTypeSelector = (id: number): string => `tr[name=recordDNS_${id - 1}] select.recordType`;
        const addDnsRecordValueSelector = (id: number): string => `tr[name=recordDNS_${id - 1}] textarea.recordValue`;
        const dnsModalApplyLinkSelector: string = 'div#modalDNS a.apply';
        const dnsRecordsSubmitButtonSelector: string = 'div.console-apply a.submit';

        await this.page.goto(`https://controlpanel.register.it/firstLevel/view.html?domain=${this.domain}`)
            .then(async () => this.page.waitForSelector(domainSelector))
            .then(async () => this.page.$(domainSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => logger.trace(`clicking \`${this.domain}\` link`))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(domainAndDnsLinkSelector))
            .then(() => logger.trace('clicking `DOMAIN & DNS` link'))
            .then(async () => this.page.$(domainAndDnsLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(dnsConfigurationLinkSelector))
            .then(() => logger.trace('clicking `DNS configuration` link'))
            .then(async () => this.page.$(dnsConfigurationLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation())
            .then(async () => this.page.waitForSelector(advancedTabLinkSelector))
            .then(() => logger.trace('clicking `Advanced` link'))
            .then(async () => this.page.$(advancedTabLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation());

        try {
            await this.page.waitForSelector(addDnsRecordNameSelector(id), { timeout: 1000 });
        } catch (error) {
            if (error instanceof TimeoutError)
                throw new DnsRecordNotFoundError;
        }

        await this.page.waitForSelector(addDnsRecordNameSelector(id))
            .then(async () => this.page.$(addDnsRecordNameSelector(id)))
            .then(async (el: ElementHandle<HTMLInputElement>) => el.evaluate(el => el.value =''))
            .then(() => logger.trace('updating `name` value'))
            .then(async () => this.page.$(addDnsRecordNameSelector(id)))
            .then(async (el: ElementHandle<HTMLInputElement>) => el.type(record.name))
            .then(async () => this.page.$(addDnsRecordTtlSelector(id)))
            .then(async (el: ElementHandle<HTMLInputElement>) => el.evaluate(el => el.value = ''))
            .then(() => logger.trace('updating `ttl` value'))
            .then(async () => this.page.$(addDnsRecordTtlSelector(id)))
            .then(async (el: ElementHandle<HTMLInputElement>) => el.type(record.ttl.toString()))
            .then(() => logger.trace('updating `type` value'))
            .then(async () => this.page.$(addDnsRecordTypeSelector(id)))
            .then(async (el: ElementHandle<HTMLSelectElement>) => el.type(record.type))
            .then(async () => this.page.$(addDnsRecordValueSelector(id)))
            .then(async (el: ElementHandle<HTMLInputElement>) => el.evaluate(el => el.value = ''))
            .then(() => logger.trace('updating `value` value'))
            .then(async () => this.page.$(addDnsRecordValueSelector(id)))
            .then(async (el: ElementHandle<HTMLInputElement>) => el.type(record.value))
            .then(async () => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(async () => await delay(1000))
            .then(() => logger.trace('clicking `apply` button'))
            .then(async () => this.page.$(dnsModalApplyLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForSelector(dnsRecordsSubmitButtonSelector))
            .then(() => logger.trace('clicking `submit` button'))
            .then(async () => this.page.$(dnsRecordsSubmitButtonSelector))
            .then(async (el: ElementHandle<HTMLButtonElement>) => el.evaluate(el => el.click()))
            .then(async () => await delay(1000))
            .then(async () => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(() => logger.trace('clicking `apply` button'))
            .then(async () => this.page.$(dnsModalApplyLinkSelector))
            .then(async (el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(async () => this.page.waitForNavigation());

        return { id, ...record } as ExistingDnsRecord;
    }

    public async closeConnection(): Promise<void> {
        await this.page.close();
        await this.browser.close();
    }
}