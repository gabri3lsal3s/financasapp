package com.minhasfinancas.assistant

import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import okhttp3.MediaType.Companion.toMediaType

interface AccessTokenProvider {
    suspend fun getAccessToken(): String?
}

object AndroidBridgeClientFactory {

    fun createApi(
        baseUrl: String,
        tokenProvider: AccessTokenProvider,
        enableHttpLog: Boolean = false,
    ): AssistantBridgeApi {
        val authInterceptor = Interceptor { chain ->
            val requestBuilder = chain.request().newBuilder()
            val token = kotlinx.coroutines.runBlocking { tokenProvider.getAccessToken() }

            if (!token.isNullOrBlank()) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
            }

            requestBuilder.addHeader("Content-Type", "application/json")
            chain.proceed(requestBuilder.build())
        }

        val okHttpBuilder = OkHttpClient.Builder().addInterceptor(authInterceptor)

        if (enableHttpLog) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            okHttpBuilder.addInterceptor(logging)
        }

        val json = Json {
            ignoreUnknownKeys = true
            isLenient = true
            explicitNulls = false
        }

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpBuilder.build())
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(AssistantBridgeApi::class.java)
    }
}
