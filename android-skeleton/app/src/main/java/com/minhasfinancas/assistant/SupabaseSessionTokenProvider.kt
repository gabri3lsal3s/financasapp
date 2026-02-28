package com.minhasfinancas.assistant

interface SupabaseAuthSessionSource {
    suspend fun currentAccessToken(): String?
}

class SupabaseSessionTokenProvider(
    private val sessionSource: SupabaseAuthSessionSource,
) : AccessTokenProvider {
    override suspend fun getAccessToken(): String? = sessionSource.currentAccessToken()
}

class LambdaSessionSource(
    private val reader: suspend () -> String?,
) : SupabaseAuthSessionSource {
    override suspend fun currentAccessToken(): String? = reader()
}

/*
 Exemplo de adapter para Supabase-KT (ajuste conforme sua versão da lib):

 import io.github.jan.supabase.SupabaseClient
 import io.github.jan.supabase.auth.auth

 class SupabaseKtSessionSource(
     private val supabaseClient: SupabaseClient,
 ) : SupabaseAuthSessionSource {
     override suspend fun currentAccessToken(): String? {
         return supabaseClient.auth.currentSessionOrNull()?.accessToken
     }
 }
*/
