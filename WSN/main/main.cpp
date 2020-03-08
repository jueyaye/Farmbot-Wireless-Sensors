
#include "esp_event.h"
#include "nvs_flash.h"

#include "TheThingsNetwork.h"

extern "C" {
    #include "bluetooth_module.h"

    #include <time.h>
    #include <sys/time.h>

    #include "esp_sleep.h"
    #include "driver/rtc_io.h"
    #include "soc/rtc_cntl_reg.h"
    #include "soc/rtc.h"

    static RTC_DATA_ATTR struct timeval sleep_enter_time;
    int wakeup_time_sec = 60; 
}

// NOTE:
// The LoRaWAN frequency and the radio chip must be configured by running 'make menuconfig'.
// Go to Components / The Things Network, select the appropriate values and save.

const char *devEui = "2233445566778899";

const char *appEui = "1122334455667788";
const char *appKey = "01020304050607080910111213141516";

// Pins and other resources
#define TTN_SPI_HOST      HSPI_HOST
#define TTN_SPI_DMA_CHAN  1
#define TTN_PIN_SPI_SCLK  14
#define TTN_PIN_SPI_MOSI  13
#define TTN_PIN_SPI_MISO  12
#define TTN_PIN_NSS       16
#define TTN_PIN_RXTX      TTN_NOT_CONNECTED
#define TTN_PIN_RST       5
#define TTN_PIN_DIO0      26
#define TTN_PIN_DIO1      33

static TheThingsNetwork ttn;

char * responseFromBLE;

const unsigned TX_INTERVAL = 1;

void sendMessages(void* pvParameter)
{
    while (1) {
        if(xQueueReceive(messageQueue,&responseFromBLE,0) == pdTRUE) {
            printf("Sending message...\n");
            printf("%s\n", responseFromBLE);

            TTNResponseCode res = ttn.transmitMessage((uint8_t *)responseFromBLE, 48);
            printf(res == kTTNSuccessfulTransmission ? "Message sent.\n" : "Transmission failed.\n");
        }

        vTaskDelay(TX_INTERVAL * 1000 / portTICK_PERIOD_MS);

        if(xSemaphore != NULL && xSemaphoreTake( xSemaphore, ( TickType_t ) 10 ) == pdTRUE){
            printf("BLECycleCounter: %d\n", bleCycleCounter);

            if(bleCycleCounter > 3){
                gettimeofday(&sleep_enter_time, NULL);
                esp_deep_sleep_start();

            }

            xSemaphoreGive( xSemaphore );   
        }
    }
}

void messageReceived(const uint8_t* message, size_t length, port_t port)
{
    printf("Message of %d bytes received on port %d:", length, port);
    for (int i = 0; i < length; i++)
        printf(" %02x", message[i]);
    printf("\n");
}

extern "C" void app_main(void)
{
    struct timeval now;
    gettimeofday(&now, NULL);
    int sleep_time_ms = (now.tv_sec - sleep_enter_time.tv_sec) * 1000 + (now.tv_usec - sleep_enter_time.tv_usec) / 1000;

    vTaskDelay(1000 / portTICK_PERIOD_MS);

    printf("Enabling timer wakeup, %ds\n", wakeup_time_sec);
    esp_sleep_enable_timer_wakeup(wakeup_time_sec * 1000000);

    // Isolate GPIO12 pin from external circuits. This is needed for modules
    // which have an external pull-up resistor on GPIO12 (such as ESP32-WROVER)
    // to minimize current consumption.
    rtc_gpio_isolate(GPIO_NUM_12);

    switch (esp_sleep_get_wakeup_cause()) {
        case ESP_SLEEP_WAKEUP_TIMER:
            printf("Wake up from timer. Time spent in deep sleep: %dms\n", sleep_time_ms);

            esp_err_t err;
            // Initialize the GPIO ISR handler service
            err = gpio_install_isr_service(ESP_INTR_FLAG_IRAM);
            ESP_ERROR_CHECK(err);

            // Initialize the NVS (non-volatile storage) for saving and restoring the keys
            err = nvs_flash_init();
            ESP_ERROR_CHECK(err);

            // init BLE
            messageQueue = xQueueCreate(1, 48); // 1 item queue that can hold colors
            xSemaphore = NULL;

            esp_gattc_init();

            // Initialize SPI bus
            spi_bus_config_t spi_bus_config;
            spi_bus_config.miso_io_num = TTN_PIN_SPI_MISO;
            spi_bus_config.mosi_io_num = TTN_PIN_SPI_MOSI;
            spi_bus_config.sclk_io_num = TTN_PIN_SPI_SCLK;
            spi_bus_config.quadwp_io_num = -1;
            spi_bus_config.quadhd_io_num = -1;
            spi_bus_config.max_transfer_sz = 0;
            err = spi_bus_initialize(TTN_SPI_HOST, &spi_bus_config, TTN_SPI_DMA_CHAN);
            ESP_ERROR_CHECK(err);

            // Configure the SX127x pins
            ttn.configurePins(TTN_SPI_HOST, TTN_PIN_NSS, TTN_PIN_RXTX, TTN_PIN_RST, TTN_PIN_DIO0, TTN_PIN_DIO1);

            ttn.provision(devEui, appEui, appKey);

            ttn.onMessage(messageReceived);

            printf("Joining...\n");
            if (ttn.join())
            {
                printf("Joined.\n");
                xTaskCreate(sendMessages, "send_messages", 1024 * 4, (void* )0, 3, NULL);
            }
            else
            {
                printf("Join failed. Goodbye\n");
                
                gettimeofday(&sleep_enter_time, NULL);
                esp_deep_sleep_start();
            }

            break;
        

        case ESP_SLEEP_WAKEUP_UNDEFINED:

        default:
            printf("First boot...\n");
            
            gettimeofday(&sleep_enter_time, NULL);
            esp_deep_sleep_start();
    }
}
