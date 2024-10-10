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
    private readonly isDebugDisabled: boolean;

    public constructor(
        username: string,
        password: string,
        domain: string,
        maxLoginAttempts: number = 0,
        headless: boolean = true,
        isDebugDisabled: boolean = true
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
        this.isDebugDisabled = isDebugDisabled;

        if (this.isDebugDisabled)
            console.debug = () => {};
    }

    private async initialize(): Promise<void> {
        this.browser = await puppeteer.launch({ headless: this.headless, args: ['--no-sandbox', '--start-maximized'] });
        this.page = await this.browser.newPage();

        this.page
            .on('load',  () => console.debug(`page loaded \`${this.page.url()}\``))
            .on('dialog', async (dialog: Dialog) => {
                console.debug('accepting dialog');

                return Promise.resolve(await dialog.accept());
            });

        await this.page.exposeFunction('confirm', () => () => {});
        await this.page.setViewport({ height: 1366, width: 900 });
        const userAgent: string = (new UserAgent).random()
            .toString();
        await this.page.setUserAgent(userAgent);
        console.debug(`setting useragent to \`${userAgent}\``);

        await this.page.goto('https://controlpanel.register.it/welcome.html');
    }

    private async closeCookiesModal(): Promise<void> {
        const cookiesRejectButtonSelector: string = 'button.iubenda-cs-reject-btn';
        this.page.waitForSelector(cookiesRejectButtonSelector)
            .then(() => this.page.$(cookiesRejectButtonSelector))
            .then((el: ElementHandle<Element>) => el.evaluate((el: Element) => (el as HTMLButtonElement).click()))
            .then(() => console.debug('clicked `reject all cookies` button'));
    }

    private async login() {
        let loginAttempts: number = 0;

        do {
            const loginSelector: string = 'form#formLogin input.userName';
            const passwordSelector: string = 'form#formLogin input.password';
            const loginButtonSelector: string = '.standard-login-module button.btn-primary';

            if (this.maxLoginAttempts > 0) {
                console.debug(`performing ${loginAttempts + 1} of ${this.maxLoginAttempts} login attempt`);
                await this.page.waitForSelector(loginSelector)
                    .then(() => this.page.$(loginSelector))
                    .then((el: ElementHandle<HTMLInputElement>) => el.type(this.username, { delay: 100 }))
                    .then(() => this.page.$(passwordSelector))
                    .then((el: ElementHandle<HTMLInputElement>) => el.type(this.password, { delay: 100 }))
                    .then(() => console.debug('clicking `login` button'))
                    .then(() => delay(1000))
                    .then(() => this.page.screenshot({ path: tmpdir + '/' + 'screenshot.jpg' }))
                    .then(() => this.page.$(loginButtonSelector))
                    .then((el: ElementHandle<HTMLButtonElement>) => el.evaluate(el => el.click()))
                    .then(() => this.page.waitForNetworkIdle());

            }

            loginAttempts++;

            if (this.maxLoginAttempts === loginAttempts)
                throw new Error('Max login attempts reached, please try again later');

        } while (this.page.url() !== 'https://controlpanel.register.it/' && ((this.maxLoginAttempts as unknown as boolean) && loginAttempts < this.maxLoginAttempts));

        console.debug('logged in');
        this.alreadyLoggedIn = true;
    }

    public async getDnsRecords(): Promise<ExistingDnsRecord[]> {
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
            .then(() => this.page.waitForSelector(domainSelector))
            .then(() => this.page.$(domainSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate((el: HTMLAnchorElement) => el.click()))
            .then(() => console.debug(`clicking \`${this.domain}\` link`))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(domainAndDnsLinkSelector))
            .then(() => console.debug('clicking `DOMAIN & DNS` link'))
            .then(() => this.page.$(domainAndDnsLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate((el: HTMLAnchorElement) => el.click()))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(dnsConfigurationLinkSelector))
            .then(() => console.debug('clicking `DNS configuration` link'))
            .then(() => this.page.$(dnsConfigurationLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate((el: HTMLAnchorElement) => el.click()))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(advancedTabLinkSelector))
            .then(() => console.debug('clicking `Advanced` link'))
            .then(() => this.page.$(advancedTabLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate((el: HTMLAnchorElement) => el.click()))
            .then(() => this.page.waitForNavigation());

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
            .then(() => this.page.waitForSelector(domainSelector))
            .then(() => this.page.$(domainSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => console.debug(`clicking \`${this.domain}\` link`))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(domainAndDnsLinkSelector))
            .then(() => console.debug('clicking `DOMAIN & DNS` link'))
            .then(() => this.page.$(domainAndDnsLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(dnsConfigurationLinkSelector))
            .then(() => console.debug('clicking `DNS configuration` link'))
            .then(() => this.page.$(dnsConfigurationLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(advancedTabLinkSelector))
            .then(() => console.debug('clicking `Advanced` link'))
            .then(() => this.page.$(advancedTabLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation());

        try {
            await this.page.waitForSelector(dnsRecordRemoveActionLinkSelector(id), { timeout: 1000 });
        } catch (error) {
            if (error instanceof TimeoutError)
                throw new DnsRecordNotFoundError;
        }

        await this.page.waitForSelector(dnsRecordRemoveActionLinkSelector(id))
            .then(() => console.debug('clicking `remove` link'))
            .then(() => this.page.$(dnsRecordRemoveActionLinkSelector(id)))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(() => delay(1000))
            .then(() => console.debug('clicking `apply` button'))
            .then(() => this.page.$(dnsModalApplyLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            // .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(dnsRecordsSubmitButtonSelector))
            .then(() => console.debug('clicking `submit` button'))
            .then(() => this.page.$(dnsRecordsSubmitButtonSelector))
            .then((el: ElementHandle<HTMLButtonElement>) => el.evaluate(el => el.click()))
            .then(() => delay(1000))
            .then(() => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(() => console.debug('clicking `apply` button'))
            .then(() => this.page.$(dnsModalApplyLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))

            .then(() => this.page.waitForNavigation());
    }
    public async addDnsRecord(record: { name: string; ttl: string | number; type: string; value: string }): Promise<ExistingDnsRecord> {
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
            .then(() => this.page.waitForSelector(domainSelector))
            .then(() => this.page.$(domainSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => console.debug(`clicking \`${this.domain}\` link`))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(domainAndDnsLinkSelector))
            .then(() => console.debug('clicking `DOMAIN & DNS` link'))
            .then(() => this.page.$(domainAndDnsLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(dnsConfigurationLinkSelector))
            .then(() => console.debug('clicking `DNS configuration` link'))
            .then(() => this.page.$(dnsConfigurationLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(advancedTabLinkSelector))
            .then(() => console.debug('clicking `Advanced` link'))
            .then(() => this.page.$(advancedTabLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation())

            .then(() => this.page.waitForSelector(addDnsRecordButtonSelector))
            .then(() => console.debug('clicking `add` link'))
            .then(() => this.page.$(addDnsRecordButtonSelector)
                .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
                .then(() => this.page.$$('.rMain'))
                .then((elements: ElementHandle[]) => elements.length));

        await this.page.$(addDnsRecordNameSelector(id))
            .then((el: ElementHandle<HTMLInputElement>) => el.type(record.name))
            .then(() => this.page.$(addDnsRecordTtlSelector(id)))
            .then((el: ElementHandle<HTMLInputElement>) => el.type(record.ttl.toString()))
            .then(() => this.page.$(addDnsRecordTypeSelector(id)))
            .then((el: ElementHandle<HTMLSelectElement>) => el.type(record.type))
            .then(() => this.page.$(addDnsRecordValueSelector(id)))
            .then((el: ElementHandle<HTMLInputElement>) => el.type(record.value))
            .then(() => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(() => delay(1000))
            .then(() => console.debug('clicking `apply` button'))
            .then(() => this.page.$(dnsModalApplyLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForSelector(dnsRecordsSubmitButtonSelector))
            .then(() => console.debug('clicking `submit` button'))
            .then(() => this.page.$(dnsRecordsSubmitButtonSelector))
            .then((el: ElementHandle<HTMLButtonElement>) => el.evaluate(el => el.click()))
            .then(() => delay(1000))
            .then(() => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(() => console.debug('clicking `apply` button'))
            .then(() => this.page.$(dnsModalApplyLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation());

        return { id, ...record } as ExistingDnsRecord;
    }

    public async updateDnsRecord(id: number, record: DnsRecord): Promise<ExistingDnsRecord> {
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
            .then(() => this.page.waitForSelector(domainSelector))
            .then(() => this.page.$(domainSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => console.debug(`clicking \`${this.domain}\` link`))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(domainAndDnsLinkSelector))
            .then(() => console.debug('clicking `DOMAIN & DNS` link'))
            .then(() => this.page.$(domainAndDnsLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(dnsConfigurationLinkSelector))
            .then(() => console.debug('clicking `DNS configuration` link'))
            .then(() => this.page.$(dnsConfigurationLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation())
            .then(() => this.page.waitForSelector(advancedTabLinkSelector))
            .then(() => console.debug('clicking `Advanced` link'))
            .then(() => this.page.$(advancedTabLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation());

        try {
            await this.page.waitForSelector(addDnsRecordNameSelector(id), { timeout: 1000 });
        } catch (error) {
            if (error instanceof TimeoutError)
                throw new DnsRecordNotFoundError;
        }

        await this.page.waitForSelector(addDnsRecordNameSelector(id))
            .then(() => this.page.$(addDnsRecordNameSelector(id)))
            .then((el: ElementHandle<HTMLInputElement>) => el.evaluate(el => el.value =''))
            .then(() => console.debug('updating `name` value'))
            .then(() => this.page.$(addDnsRecordNameSelector(id)))
            .then((el: ElementHandle<HTMLInputElement>) => el.type(record.name))
            .then(() => this.page.$(addDnsRecordTtlSelector(id)))
            .then((el: ElementHandle<HTMLInputElement>) => el.evaluate(el => el.value = ''))
            .then(() => console.debug('updating `ttl` value'))
            .then(() => this.page.$(addDnsRecordTtlSelector(id)))
            .then((el: ElementHandle<HTMLInputElement>) => el.type(record.ttl.toString()))
            .then(() => console.debug('updating `type` value'))
            .then(() => this.page.$(addDnsRecordTypeSelector(id)))
            .then((el: ElementHandle<HTMLSelectElement>) => el.type(record.type))
            .then(() => this.page.$(addDnsRecordValueSelector(id)))
            .then((el: ElementHandle<HTMLInputElement>) => el.evaluate(el => el.value = ''))
            .then(() => console.debug('updating `value` value'))
            .then(() => this.page.$(addDnsRecordValueSelector(id)))
            .then((el: ElementHandle<HTMLInputElement>) => el.type(record.value))
            .then(() => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(() => delay(1000))
            .then(() => console.debug('clicking `apply` button'))
            .then(() => this.page.$(dnsModalApplyLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForSelector(dnsRecordsSubmitButtonSelector))
            .then(() => console.debug('clicking `submit` button'))
            .then(() => this.page.$(dnsRecordsSubmitButtonSelector))
            .then((el: ElementHandle<HTMLButtonElement>) => el.evaluate(el => el.click()))
            .then(() => delay(1000))
            .then(() => this.page.waitForSelector(dnsModalApplyLinkSelector))
            .then(() => console.debug('clicking `apply` button'))
            .then(() => this.page.$(dnsModalApplyLinkSelector))
            .then((el: ElementHandle<HTMLAnchorElement>) => el.evaluate(el => el.click()))
            .then(() => this.page.waitForNavigation());

        return { id, ...record } as ExistingDnsRecord;
    }

    public async closeConnection(): Promise<void> {
        await this.page.close();
        await this.browser.close();
    }
}