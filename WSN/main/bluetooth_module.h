
#ifndef __BLUETOOTH_MODULE_H__
#define __BLUETOOTH_MODULE_H__

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"

#define GATTC_TAG 						"GATTC_DEMO"
#define REMOTE_SERVICE_UUID         	0x1204
#define REMOTE_NOTIFY_CHAR_UUID     	0x1a00

#define REMOTE_RESPONSE_DATA_CHAR_UUID   	0x1a01
#define REMOTE_RESPONSE_DEVICE_CHAR_UUID   	0x1a02

#define PROFILE_NUM      				1
#define PROFILE_A_APP_ID 				0
#define INVALID_HANDLE   				0

static const char remote_device_name[] = "Flower care";

QueueHandle_t messageQueue;
SemaphoreHandle_t xSemaphore;

int bleCycleCounter;

int esp_gattc_init();

#endif