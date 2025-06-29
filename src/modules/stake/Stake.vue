<template>
    <div class="bg-slate-800 min-h-screen flex items-center justify-center p-4 font-sans">
        <Card
            :pt="{
                root: { class: '!bg-slate-700 shadow-2xl rounded-2xl border-0' },
                body: { class: 'p-6 sm:p-8' },
                content: { class: 'p-0' }
            }"
            class="max-w-md mx-auto w-full"
        >
            <template #content>
                <div v-if="!phantomInstalled" class="text-center text-gray-300">
                    <i class="pi pi-wallet text-4xl text-indigo-400 mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Phantom Wallet Não Encontrada</h3>
                    <p class="mb-4 text-slate-400">Para interagir, você precisa instalar a extensão Phantom.</p>
                    <a href="https://phantom.app/" target="_blank">
                        <Button class="bg-indigo-600 hover:bg-indigo-700 border-0" icon="pi pi-external-link"
                                label="Instalar Phantom"/>
                    </a>
                </div>
                <div v-else>
                    <div v-if="!walletAddress" class="text-center">
                        <Button
                            class="w-full p-button-lg bg-indigo-600 hover:bg-indigo-700 border-0"
                            label="Conectar Phantom"
                            @click="connectWallet"
                        />
                    </div>
                    <div v-else>
                        <div class="flex justify-between items-center mb-6">
                            <span class="bg-slate-800 text-primary-300 text-sm font-mono px-3 py-2 rounded-lg truncate">
                                {{ walletAddress }}
                            </span>
                            <Button
                                label="Sair"
                                severity="danger"
                                size="small"
                                text
                                @click="disconnectWallet"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2" for="amount">Valor</label>
                            <InputGroup>
                                <InputNumber
                                    v-model="amount"
                                    :max="solBalance"
                                    :maxFractionDigits="9"
                                    :min="0"
                                    :minFractionDigits="2"
                                    :pt="{
                                        input: { root: { class: 'w-full text-lg bg-slate-800 border-slate-700 text-white placeholder-gray-500' } }
                                    }"
                                    inputId="amount"
                                    mode="decimal"
                                    placeholder="0.0"
                                />
                                <InputGroupAddon class="bg-slate-700 border-slate-600 text-slate-300">SOL
                                </InputGroupAddon>
                            </InputGroup>
                            <div class="flex items-center justify-between mt-1">
                                <small class="text-slate-300">Saldo disponível</small>
                                <small class="text-slate-200">{{ solBalance }} SOL</small>
                            </div>
                        </div>
                        <div class="mt-4 space-y-3">
                            <div class="grid grid-cols-2 gap-3">
                                <Button
                                    :disabled="!amount || amount > stakeAmount"
                                    :loading="loading"
                                    class="w-full bg-slate-700 hover:bg-slate-600 border-slate-600 disabled:bg-slate-800 disabled:text-gray-600"
                                    label="Sacar"
                                    @click="handleWithdraw"
                                />
                                <Button
                                    :disabled="!amount || amount <= 0"
                                    :loading="loading"
                                    class="w-full p-button-lg bg-indigo-600 hover:bg-indigo-700 border-0 disabled:bg-indigo-950 disabled:text-gray-500"
                                    label="Depositar"
                                    @click="handleStake"
                                />
                            </div>
                        </div>
                        <div class="mt-6 pt-6 border-t border-slate-800 space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="text-slate-300">Valor depositado</span>
                                <span class="text-white font-mono font-semibold">
                                    {{ stakeAmount !== null ? (stakeAmount).toFixed(4) + ' SOL' : 'N/A' }}
                                </span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-slate-300">Último depósito</span>
                                <span class="text-white font-mono font-semibold text-sm">
                                    {{
                                        stakeTime !== null ? new Date(stakeTime * 1000).toLocaleString('pt-BR') : 'N/A'
                                    }}
                                </span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-slate-300">Taxa de Juros</span>
                                <span class="bg-green-900 text-green-300 text-xs font-semibold px-2 py-1 rounded-md">5% ao mês</span>
                            </div>
                            <div class="bg-slate-800 py-2 px-3 rounded-lg border border-slate-500">
                                <div class="flex justify-between items-center">
                                    <span class="text-slate-300 font-semibold">Saldo </span>
                                    <span class="text-green-400 font-bold font-mono text-lg">
                                        <i v-if="currentStakedValue === null && stakeAmount !== null"
                                           class="pi pi-spin pi-spinner"></i>
                                        <span v-else-if="currentStakedValue !== null">{{
                                                currentStakedValue.toFixed(8)
                                            }} SOL</span>
                                        <span v-else>N/A</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </Card>
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, BN, Program, utils, web3 } from '@project-serum/anchor';
// @ts-ignore
import idl from '@/idl/solana_stake.json';
import { useToast } from 'primevue';

const toast = useToast();
const PROGRAM_ID = new PublicKey('EHHZ67oF9xMX2cuRKtiKdL2rVsV8dQ3CnQcpARcmt5UC');
// use 'http://127.0.0.1:8899' se for local
const network = 'http://127.0.0.1:8899';
const connection = new Connection(network, 'processed');

const phantomInstalled = ref(false);
const walletAddress = ref<string | null>(null);
const amount = ref('');
const stakeAmount = ref<number | null>(null);
const stakeTime = ref<number | null>(null);
const solBalance = ref<number | null>(null);
const loading = ref(false);
const currentTime = ref(Math.floor(Date.now() / 1000));
let timer: number;

onMounted(() => {

    checkPhantom();
    if (window.solana?.isPhantom && window.solana.isConnected) {
        walletAddress.value = window.solana.publicKey?.toString() ?? null;
        fetchStakeAccount();
    }

    timer = setInterval(() => {
        currentTime.value = Math.floor(Date.now() / 1000);
    }, 1000);
});

function checkPhantom() {
    phantomInstalled.value = !!window.solana && window.solana.isPhantom;
}

async function connectWallet() {

    try {

        const resp = await window.solana.connect();
        walletAddress.value = resp.publicKey.toString();
        fetchStakeAccount();
        fetchSolBalance();

    } catch (e) {

        toast.add({
            closable: true,
            life: 5000,
            detail: 'Conexão foi recusada',
            summary: 'Recusado',
            severity: 'error'
        });
    }
}

async function disconnectWallet() {

    await window.solana.disconnect();
    walletAddress.value = null;
    toast.add({
        closable: true,
        life: 5000,
        detail: 'Sua carteira foi desconectada',
        summary: 'Atenção',
        severity: 'warn'
    });
}

function getProvider() {
    if (!window.solana || !walletAddress.value) return null;
    return new AnchorProvider(connection, window.solana, { preflightCommitment: 'processed' });
}

const program = computed(() => getProvider() ? new Program(idl as any, PROGRAM_ID, getProvider()!) : null);

async function getUserStakePDA(user: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
        [
            utils.bytes.utf8.encode('stake'),
            user.toBuffer()
        ],
        PROGRAM_ID
    );
}

async function fetchStakeAccount() {

    if (!walletAddress.value || !program.value) return;
    const [userStakePda] = await getUserStakePDA(new PublicKey(walletAddress.value));

    try {

        const account = await program.value.account.userStake.fetch(userStakePda);
        stakeAmount.value = Number(account.amount.toString()) / 1e9;
        stakeTime.value = Number(account.stakeTimestamp);

    } catch {

        stakeAmount.value = null;
        stakeTime.value = null;
    }
}

async function handleStake() {

    if (!walletAddress.value || !program.value || !amount.value) return;
    loading.value = true;

    try {

        const [userStakePda] = await getUserStakePDA(new PublicKey(walletAddress.value));
        await program.value.methods
                     .stake(new BN(Number(amount.value) * 1e9))
                     .accounts({
                         userStake: userStakePda,
                         user: new PublicKey(walletAddress.value),
                         systemProgram: web3.SystemProgram.programId,
                     })
                     .rpc();
        await fetchStakeAccount();

        toast.add({
            closable: true,
            life: 5000,
            detail: 'Depósito realizado',
            summary: 'Sucesso',
            severity: 'success'
        });

    } catch (e: any) {

        toast.add({
            closable: true,
            life: 5000,
            detail: 'Não foi possível realizar o depósito',
            summary: 'Erro',
            severity: 'error'
        });
    }
    loading.value = false;
}

async function handleWithdraw() {

    if (!walletAddress.value || !program.value) return;
    loading.value = true;

    try {

        const [userStakePda] = await getUserStakePDA(new PublicKey(walletAddress.value));
        await program.value.methods
                     .withdraw()
                     .accounts({
                         userStake: userStakePda,
                         user: new PublicKey(walletAddress.value),
                     })
                     .rpc();
        await fetchStakeAccount();

        toast.add({
            closable: true,
            life: 5000,
            detail: 'Saque realizado',
            summary: 'Sucesso',
            severity: 'success'
        });

    } catch (e: any) {

        toast.add({
            closable: true,
            life: 5000,
            detail: 'Não foi possível realizar o saque',
            summary: 'Erro',
            severity: 'error'
        });
    }
    loading.value = false;
}

async function fetchSolBalance() {

    if (!walletAddress.value) return;

    try {

        const publicKey = new PublicKey(walletAddress.value);
        const balanceInLamports = await connection.getBalance(publicKey);
        solBalance.value = balanceInLamports / web3.LAMPORTS_PER_SOL;

    } catch (e) {

        solBalance.value = null;
        toast.add({
            severity: 'error',
            summary: 'Erro de Saldo',
            detail: 'Não foi possível carregar o saldo da carteira.',
            life: 3000
        });
    }
}

const currentStakedValue = computed(() => {

    if (stakeAmount.value === null || stakeTime.value === null) return null;

    const principal = stakeAmount.value;
    const startTime = stakeTime.value;
    const now = currentTime.value;

    const elapsedSeconds = now - startTime;

    if (elapsedSeconds <= 0) return principal;

    const monthlyRate = 0.05;
    const secondsInMonth = 30 * 24 * 60 * 60;
    const ratePerSecond = Math.pow(1 + monthlyRate, 1 / secondsInMonth) - 1;

    return principal * Math.pow(1 + ratePerSecond, elapsedSeconds);
});

</script>
