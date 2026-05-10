---
title: NDS固件（firmware）及第三方自定义固件FlashMe相关历史梳理
layout: post
author: wokann
excerpt: "NDS固件（firmware）及第三方自定义固件FlashMe相关历史梳理"
---

# 一、前言
NDS固件（firmware）是任天堂的双屏多媒体互动系统Nintendo Dual Screen（简称NDS）的系统固件，存储于机身256KB/512KB的eeprom芯片中，用于引导校验加载游戏卡带，并提供设置语言、个性化昵称、界面颜色、时间等内容及主菜单界面的显示。它与机身的BIOS9、BIOS7共同组成了NDS运行游戏卡带的底层数据。<br>
现如今在互联网上关于NDS固件的信息鱼龙混杂，其历史版本的相关内容混杂了大量的似是而非的错误或不完善的各种说法。<br>
在经过对于各种资料的梳理，以及相关软件的代码挖掘分析，我得以理清关于固件版本的相关信息，并将此整理成文，以供目前或以后对此感兴趣的玩家或研究者检索参考。<br>
本文仅讨论关于DS初代、DSlite的固件内容，dsi、3ds上的ds固件数据结构存在较大差异，不在本文讨论范围内。<br>

# 二、NDS固件的结构
在对于固件版本的历史梳理之前，需要先对固件的结构进行介绍，因其结构中包含了对于版本判断有所帮助的相关数据线索。<br>
这里摘取引用gbatek的相关资料:<br>
```
Firmware Memory Map
  00000h-00029h  Firmware Header
  0002Ah-001FFh  Wifi Calibration
 -WORLD WIDE
  00200h-3F9FFh  Firmware Code/Data
  3FA00h-3FDFFh  Wifi Settings 1,2,3 (3FD00h-3FDFFh dummy)
  3FE00h-3FFFFh  User Settings 1,2
 -CHN [iQue] / KOR
  00200h-7F9FFh  Firmware Code/Data
  7FA00h-7FDFFh  Wifi Settings 1,2,3 (7FD00h-7FDFFh dummy)
  7FE00h-7FFFFh  User Settings 1,2
```
固件内容主要分为两大块内容，即**固件核心数据**与**固件私有数据**。下文不会对固件结构的每一条内容都进行详细解释，仅对与本文主题关联较深的部分多着笔墨。<br>
## 2.1 固件核心数据（Core data）
**固件核心数据**，包括位于固件开头的文件头`00000h-00029h  Firmware Header`以及占据固件整个容量主体部分的核心程序`00200h-3F9FFh  Firmware Code/Data`（256KB国际版固件）或`00200h-7F9FFh  Firmware Code/Data`（512kb神游或韩版固件）。<br>
这两部分的数据，是用于区分固件归属于不同版本的主要数据。将除这两部分外的数据全部填充0xFF，并裁剪末尾数据直到`Firmware Code/Data`的最后有效数据处，对其进行CRC-32/ISO-HDLC校验，得到的数据便是该固件版本的crc32校验值。<br>
不同DS主机如果持有相同的固件版本，那么核心数据部分的2个内容必定是完全相同的。<br>
### 2.1.1 固件文件头（Firmware Header）//00000h-00029h
```
Firmware Header (00000h-001FFh)
  Addr Size Expl.
  000h 2    part3 romaddr/8 (arm9 gui code) (LZ/huffman compression)
  002h 2    part4 romaddr/8 (arm7 wifi code) (LZ/huffman compression)
  004h 2    part3/4 CRC16 arm9/7 gui/wifi code
  006h 2    part1/2 CRC16 arm9/7 boot code
  008h 4    firmware identifier (usually nintendo "MAC",nn) (or nocash "XBOO")
            the 4th byte (nn) occassionally changes in different versions
  00Ch 2    part1 arm9 boot code romaddr/2^(2+shift1) (LZSS compressed)
  00Eh 2    part1 arm9 boot code 2800000h-ramaddr/2^(2+shift2)
  010h 2    part2 arm7 boot code romaddr/2^(2+shift3) (LZSS compressed)
  012h 2    part2 arm7 boot code 3810000h-ramaddr/2^(2+shift4)
  014h 2    shift amounts, bit0-2=shift1, bit3-5=shift2, bit6-8=shift3,
            bit9-11=shift4, bit12-15=firmware_chipsize/128K
  016h 2    part5 data/gfx romaddr/8 (LZ/huffman compression)
  018h 5    Firmware version built timestamp (BCD minute,hour,day,month,year)
  01Dh 1    Console type
              FFh=Nintendo DS
              20h=Nintendo DS-lite
              35h=KorDS-lite
              57h=Nintendo DSi (also iQueDSi)
              43h=iQueDS
              63h=iQueDS-lite
              01h=Nintendo Zone Box (Debug)
  01Eh 2    Unused (FFh-filled)
  020h 2    User Settings Offset (div8) (usually last 200h flash bytes)
  022h 4    Unknown
  026h 2    part5 CRC16 data/gfx
  028h 2    unused (FFh-filled)
```
固件头文件主要用于记录固件核心程序的5个组件在固件内部的偏移地址，以及CRC-16/MODBUS校验值，同时还记录了固件生成时的时间戳数据、该固件适用的NDS主机类型等信息。<br>
其中位于`06h-07h`的part1/2（5个组件中的前两个组件）的连锁crc16校验值数据（连锁，指先以默认初始值FFFFh进行计算part1的crc16校验值，再将该结果作为初始值进行part2的crc16校验），是第三方固件程序中，常用来作为判断当前或原始官方固件版本的依据。<br>
其中位于`18h-1Ch`的时间戳数据是用于判断固件版本的重要数据。时间戳数据是一串5字节的BCD格式的时间数据，如`45 14 07 12 05`，代表该固件的生成时间为`2005年12月07日14时45分`。
### 2.1.2 固件核心程序（Firmware Code/Data）//00200h-3F9FFh 或 00200h-7F9FFh
在前文文件头的内容中有提及，核心程序主要由5个组件组成。它们分别是：
* part1: arm9_boot_code
* part2: arm7_boot_code
* part3: arm9_gui_code
* part4: arm7_wifi_code
* part5: data_gfx

通常情况下，5个组件在固件内的顺序是按照12345排列，但也存在部分固件中，排列顺序有所变化的情况。<br>
在第三方固件中，往往会替换part1、part2的数据，以跳转引导启动的代码，并将原始的part1、2在原数据前添加相关代码内容后，作为次级引导进行调用。<br>
part1、2需要进行解密、解压两步骤，才能得到原始的程序数据。打包时同样需要进行压缩、加密，从而得到可放置于固件内的文件。<br>
part3、4、5则仅需要进行解压，即可得到原始的程序数据。打包时需要进行压缩，从而得到可放置于固件内的文件。<br>
part12和part345的解压缩，使用的是不同的解压缩方式。
## 2.2 固件私有数据（Private Data）
**固件私有数据**，包括位于头文件与核心程序中间的wifi校准数据`Wifi Calibration`，以及位于固件末尾的wifi接入点设置`Wifi Settings`和用户设置`User Settings`，这3块内容。其中，wifi校准数据`Wifi Calibration`属于该固件硬件出厂时由官方设置了每张固件硬件唯一的MAC地址，及其无线射频信号的调节设置。由于固件硬件包含了网络配置的核心物理模块及软件数据配置，所以在nds领域也称载有固件数据的这个硬件为网卡。<br>
### 2.2.1 wifi校准数据（Wifi Calibration）//0002Ah-001FFh
```
Wifi Calibration/Settings (located directly after Firmware Header)
  Addr Size Expl.
  000h-029h Firmware Header (see previous chapter)
  02Ah 2    CRC16 (with initial value 0) of [2Ch..2Ch+config_length-1]
  02Ch 2    config_length (usually 0138h, ie. entries 2Ch..163h)
  02Eh 1    Unused        (00h)
  02Fh 1    Version (0=v1..v4, 3=v5, 5=v6..v7,6=W006,15=W015,24=W024,34=N3DS)
  030h 6    Unused        (00h-filled) (DS-Lite and DSi: FF,FF,FF,FF,FF,00)
  036h 6    48bit MAC address (v1-v5: 0009BFxxxxxx, v6-v7: 001656xxxxxx)
  03Ch 128h Radio Frequency setting
  164h 9Ch  Unused (FFh-filled) (Outside CRC16 region, with config_length=138h)
```
wifi校准数据主要用于记录本网卡唯一的MAC地址数据，以及RF射频信号的校准调节。<br>
MAC地址可以进行刷写改成其他地址，但通常不建议这么做，避免与世界上不知道哪一个玩家的DS主机或乃至游戏领域外的其他网卡MAC地址冲突。<br>
RF射频信号的校准调节是网卡能否正常使用无线联机以及wifi联网的核心内容。DS网卡上的RF芯片主要有两类，对应的校准数据结构也不相同。<br>
如果两张网卡是同类型的RF芯片，那么互相刷入对方的RF校准数据，也可以正常进行联网，只是不一定是适配本芯片的最佳设置。<br>
而如果两张网卡是不同类型的RF芯片，那么刷入对方的RF校准数据，则会导致网卡无法正常使用。<br>
同样，如果这里填充为0xFF或者刷入其他不符合当前网卡RF芯片的校准数据结构的话，也一样无法使用无线功能。<br>
简单来说，如果在未进行备份原始固件的情况下，刷入了其他玩家转储dump的固件数据，导致联网功能异常的话，那么可以通过替换成另一种类型的RF校准数据的模板，可以让网卡正常启用无线功能（只是模板里的校准数据，不如工厂里原生给该硬件调节的RF校准数据更贴合该网卡RF芯片的实际物理情况）。<br>
该数据属于工厂级别出厂设置内容，不对玩家用户开放编辑。每张网卡固件里的这部分内容都是不相同的。

### 2.2.2 wifi接入点设置（Wifi Settings）//3FA00h-3FDFFh 或 7FA00h-7FDFFh
wifi接入点设置，或者说蜂窝网络、热点连接，即常规拥有wifi联机功能的nds游戏运行时，登录的3个接入点的信息，便存储于此处。<br>
该数据属于玩家个人可主动配置修改的内容。
### 2.2.3 用户设置（User Settings）//3FE00h-3FFFFh 或 7FE00h-7FFFFh
DS开机时设置的语言、昵称、生日、颜色、触摸屏校准信息、主机时间等内容存储于此。<br>
该数据属于玩家个人可主动配置修改的内容。


# 三、NDS官方固件版本
此处仅讨论零售版DS主机内的固件，不讨论原型机、调试机等设备的固件。<br>

## 3.1 版本号的民间社区命名
在早年的DS社区内，由于固件内仅存在固件生成时的时间戳，而不存在版本号的命名字符串，故民间根据主机推出时板载的固件类型的先后顺序进行排列命名。DS初代（又称phat、饭盒机）包含5个版本v1-v5，DS Lite包含2个版本v6-v7。以下是民间社区命名的版本号与其内部时间戳的对应关系：<br>
```
v1:             2004-10-05 11:07
v2:             2004-11-26 09:51
v3:             2005-02-28 08:51
v4:             2005-06-06 14:48
v5:             2005-12-07 14:45
v6 (Lite):      2006-02-05 21:33
v7 (Lite):      2006-03-08 11:19
```
在第三方固件的相关代码识别中，通过对于固件文件头`06h-07h`位置上part1/2的连锁crc16校验值数据进行识别，用以判断对应版本，以下是part12的crc16与民间社区版本号的对应关系：<br>
```
v1:             0x2c7a
v2:             0xe0ce
v3:             0xbfba
v4:             0xdfc7
v5:             0x73b3
v6 (Lite):      0xe843
v7 (Lite):      0x0f1f
```
以上7个版本均为国际版固件。除此之外，还存在位于中国地区的iQue神游DS（含初代机和Lite机）、位于韩国的KorDS（仅Lite机为韩版独立固件，韩国地区DS初代机为使用国际版DS初代主机），由于早年社区对这些版本的关注度较低，以及获取不便，故基本不存在对于这些版本的民间社区命名。此处我仿照国际版命名方式对其进行临时命名。<br>
iQue神游初代（又称phat、饭盒机）包含1个版本iQue_v1，iQue lite包含1个版本iQue_v2，韩版KorDS lite包含1个版本Kor_v1。以下是临时命名的版本号与其内部时间戳，及part12的crc16的对应关系：<br>
```
iQue_v1:        2005-06-09 21:15
iQue_v2 (Lite): 2006-04-26 15:35
Kor_v1 (Lite):  2006-11-09 21:30
```
```
iQue_v1:        0xf96d
iQue_v2 (Lite): 0x87c4
Kor_v1 (Lite):  0x74f0
```
## 3.2 过时的版本号判断方式
早年存在一种无需额外设备转储固件检查数据，就能便捷判断版本号的方式，称之为PicoChat聊天室颜色法。<br>
具体流程是:<br>
* 1、准备任意一张gba或ds卡带，在开机前插在ds主机上
* 2、打开ds主机，进入PicoChat聊天室，任意选一个房间进入
* 3、进入房间后，拔掉gba或ds卡带，ds主机将存在一定反应，可以用于判断固件版本。

判断对照为：
```
v1:             DS主机卡死
v2:             上下屏幕呈蓝色(0x3D06 #304078)
v3:             上下屏幕呈绿色(0x01E0 #007800)
v4:             上下屏幕呈黄色(0x03FF #F8F800)
v5:             上下屏幕呈紫色(0x741B #D800E8)
```
关于v6-v7网络上流传着错误的版本：
```
v6 (Lite):      上下屏幕呈深蓝色
v7 (Lite):      不卡死，一切正常
```
但实际测试情况是：
```
v6 (Lite):      上下屏幕呈紫色(0x741B #D800E8)
v7 (Lite):      上下屏幕呈紫色(0x741B #D800E8)
```
即，从v5开始之后的所有版本，均为紫色。也就是说，PicoChat聊天室颜色法仅适用于DS初代主机的5个版本进行判断（仅考虑零售时预装版本，不考虑玩家自己另行刷入lite固件或第三方固件的情况），而不适用于Lite起的版本判断。<br>
以下附上神游及韩版的PicoChat聊天室颜色情况：
```
iQue_v1:        上下屏幕呈绿色(0x01E0 #007800)
iQue_v2 (Lite): 上下屏幕呈紫色(0x741B #D800E8)
Kor_v1 (Lite):  上下屏幕呈紫色(0x741B #D800E8)
```

## 3.3 版本号的官方命名
近年来，存在泄露的官方固件刷写程序 F-Writer v1.0K 和 F-Writer v3.0 (USG) (World) (Ver1.0)。通过对其内部的残留代码的分析，我们可以从中找到官方对不同固件的命名方式。<br>
程序内存放的固件的内部路径名的格式，如：<br>
`/Ipl2/link/NTR_0512071445`<br>
`/Ipl2/link/USG_0602052133`<br>
NTR为DS初代主机的代号，USG为DS lite主机的代号，后续跟着的为该固件的生成时间戳的数据。即<br>
`/Ipl2/link/[型号]_[时间戳]`的形式为固件的文件名<br>
同时，每一个路径名同时又指向了如下几个信息，如：
```
NTR
WORLD WIDE
/Ipl2/link/NTR_0512071445
Ver5.0
0x12071445
0x80F824E1
0x00002BCA
```
```
console
region
path
official version naming
timestamp
crc32
border color of F-writer
```
即数据结构为
```
机型(console)
区域(region)
rom内文件路径(path)
官方版本号(official version naming)
时间戳后8个数字(timestamp)
crc32
F-writer边框颜色(border color of F-writer)
```

F-writer边框颜色:
```
border color:
NTR-WORLD WIDE: 0x2BCA ( #50F050) green
NTR-CHN [iQue]: 0x14BC ( #E02828) red
USG-WORLD WIDE: 0x739C ( #E0E0E0) grey
USG-CHN [iQue]: 0x161C ( #E08028) orange
USG-NIS(L):     0x2D4E ( #705058) dustyrose
USG-KOR:        0x5042 ( #1010A0) blue
```

经过统计，我们得到了大部分零售版固件对应的官方版本号命名：
```
v4:             NTR-WORLD WIDE-Ver4.0
v5:             NTR-WORLD WIDE-Ver5.0
v6 (Lite):      USG-WORLD WIDE-Ver2.0 
v7 (Lite):      USG-WORLD WIDE-Ver3.0
iQue_v1:        NTR-CHN [iQue]-Ver1.0
iQue_v2 (Lite): USG-CHN [iQue]-Ver1.0C
Kor_v1 (Lite):  USG-KOR       -Ver1.0K
```
v1-v3的官方版本命名并未包含在F-Writer中，但根据`v4,v5`的对应官方命名为`Ver4.0,Ver5.0`，有较大概率`v1-v3`的命名方式也为`Ver1.0-Ver3.0`。<br>
故最终民间社区与官方命名的对照可以整理如下：<br>
```
v1:             NTR-WORLD WIDE-Ver1.0（推测）
v2:             NTR-WORLD WIDE-Ver2.0（推测）
v3:             NTR-WORLD WIDE-Ver3.0（推测）
v4:             NTR-WORLD WIDE-Ver4.0
v5:             NTR-WORLD WIDE-Ver5.0
v6 (Lite):      USG-WORLD WIDE-Ver2.0 
v7 (Lite):      USG-WORLD WIDE-Ver3.0
iQue_v1:        NTR-CHN [iQue]-Ver1.0
iQue_v2 (Lite): USG-CHN [iQue]-Ver1.0C
Kor_v1 (Lite):  USG-KOR       -Ver1.0K
```
# 四、第三方自定义固件FlashMe
写在前头，FlashMe的`v1-v8a`版本编号，仅代表FlashMe这个第三方自定义固件自身的版本变化，与官方零售版固件的`v1-v7`不存在对应关系。<br>
这是很多人会产生误区的地方，将FlashMe的版本认为跟官方固件的版本号是对应的进行更新，但其实并没有这种关联。
## 4.1 FlashMe的作用

## 4.2 FlashMe的版本

## 4.3 FlashMe的发展

# 五、DS固件及破解时间线
为方便阅读，固件版本以民间命名方式描述
## 2004
* 2004/10/05 官方国际版v1固件制成
* 2004/11/21 NDS于北美地区发售
* 2004/11/26 官方国际版v2固件制成
* 2004/12/02 NDS于日本发售
* 2004/12/13 NDS于中国台湾发售
* 2004/12/29 NDS于韩国发售
* 2024/12/31 不晚于该日期，DarkFader(Rafael Vuijk) 已经成功dump转储Metroid Prime Hunters demo演示卡带（因为这个游戏早期是与NDS主机同捆销售的），并在个人网站上公开了基于FPGA的最早的（pass through）破解原型设备的相关代码资料。

## 2005
* 2005/01/26 Natrium42(Alexey Karpenko)基于DarkFader的资料，尝试自己使用Xilinx Spartan-3 FPGA开发套件制作pass through设备
* 2005/01/31 Natrium42设计了使用CPLD的小型的电路板，称之为PassMe，并公开了相关资料。并提及定制PCB主板主要大约2周时间，Lynx将在收到主板后进行组装。
* 2005/02/09 DarkFader开发了程序以破解crc算法，社区协力使用该程序以收集足够的信息，最终DarkFader实现了crc算法的重新实现，意味着PassMe不再仅限于特定的游戏才能使用。
* 2005/02/24 NDS于澳洲地区发售
* 2005/02/28 官方国际版v3固件制成
* 2005/03/02 Natrium42提及收到主板的人无法让其正常工作，由于他的定制主板还未生产出来，他使用同样CPLD芯片的PLCC版本进行组装验证，测试结果顺利。尽管不保证实际的PassMe主板能否正常运行，但至少证明了这个方式的可行性。
* 2005/03/04 Lynx组装了PassMe电路板并成功运行。Natrium42与Lynx随后不断对电路板结构进行优化改进。此时PassMe仅支持Metroid Prime Hunters的demo卡带。
* 2005/03/09 得益于DarkFader对于crc算法的破解并公开了新的代码资料，新版本PassMe已经可以支持任意DS卡带
* 2005/03/11 NDS于欧洲地区发售
* 2005/04/11 DarkFader公开通过短路SL1触点，可以解除固件头部0x10000数据写入保护机制的信息，并表示Loopy正在为此开发固件补丁（即后来的FlashMe）
* 2005/04/13 Tim Schuerewegen制作并发布了WMB (Wireless MultiBoot Hack)的驱动和程序，除了可以发送自制程序外，还可以实现如同PassMe的功能的WiFiMe
* 2005/04/19 不晚于该时间，NeoFlash商业版PassMe设备及烧录卡宣布即将发售，及可以免费提供套件给前来联系的DS开发者或游戏网站管理员进行测试
* 2005/04/20 FlashMe Beta版本面世（又称v0）。玩家需要通过PassMe/WiFiMe运行getID.ds.gba以生成与本机关联的序列号，再将序列号上传，以获取固件补丁程序 玩家的序列号.ds.gba，再运行该软件并短接SL1以刷入固件
* 2005/04/26 FlashMe Beta版本再次开放测试
* 2005/05/12 FlashMe_v1发布，不再像Beta版本需要提供唯一的序列号后获得固件
* 2005/05/20 不晚于该日期，NeoFlash更新官网文本正式发售（也可能是0519发售，时光机缺少19号的记录，0518官网页面还是即将发售）
* 2005/05/22 该日期起，flashme在原有.ds.gba基础上，新增提供.nds的刷写工具
* 2005/05/23 FlashMe_v2发布（时光机记录中，0524存在一个版本的flashme.ds.gba，与部分网站留档名FlashMe_v050715的数据相同）
* 2005/05/24 FlashMe_v3发布（时光机记录中，0525存在一个版本的flashme.nds，且与相邻0524的flashme.ds.gba的固件内容不同）
* 2005/06/06 官方国际版v4固件制成
* 2005/06/09 官方神游版iQue_v1固件制成
* 2005/07/23 NDS于中国大陆以神游iQue名称发售
* 2005/09/03 FlashMe_v4发布
* 2005/10    预载v4固件的国际版NDS面世。v4、iQue_v1固件均封堵了初代PassMe、WiFiMe
* ？2005/10    （Loopy破解新固件的封堵机制，PassMe2现世，PassMe2内容暂未梳理完成）
* 2005/10/07 由于对于DS固件漏洞安全性的讨论，DarkFader发布了DS Bricker，分两个版本r0mloader.nds和taihen.nds。这是DS上首个恶意软件，软件会故意损毁固件数据。DarkFader随后道歉并提供了刷写工具以还原固件。
* 2005/10/15 不晚于该日期，FlashMe_v4 新增flashme_stealth.nds版本
* 2005/10/23 YaW在gbadev.org反馈在线游玩马力欧卡丁车DS后，砖机（此时该游戏尚未发售，但是官方展厅里可以游玩到试玩版、测试版、最终版）（Diskun: I can confirm what YaW says. He could try Mario Kart DS Final Version in the Nintendo Friends Showroom at Madrid. A press room for spanish media, they have demos, betas and final versions before they are released so journalists can go and try the games or take some screenshots for reviews. YaW currently runs DSMagazine, while I'm the webmaster of NDSSpain, so you can trust in us.）
* 2005/11/03 FlashMe_v5发布，避开了固件尾部的wifi数据范围
* 2005/11/14 马力欧卡丁车DS于北美地区发售
* 2005/11    马力欧卡丁车DS作为首款支持WiFi联机功能游戏，首次将WiFi数据写入固件尾部，FlashMe_v1-v4恰好将部分数据写在这块区域导致被wifi数据覆盖，引发了砖机潮
* 2005/11/17 马力欧卡丁车DS于澳洲地区发售
* 2005/11/25 马力欧卡丁车DS于欧洲地区发售
* 2005/12/07 官方国际版v5固件制成
* 2005/12/08 马力欧卡丁车DS于日本发售

## 2006
* 2006/01/01 PicoChat聊天室颜色法被MaHe提出，此方法又被戏称TakeMeOut
* 2006/01/02 FlashMe_v6发布，支持显示当前固件版本
* 2006/01/24 据称no$gba的作者Martin Korth已经破解了DS卡带的加密规则，这将使插入slot1的PassMe设备不再需要附带一张正版DS卡带，被称之为NoPass（NoPass资料尚未梳理完成）
* 2006/01/26 新机型NDSL正式宣布即将发售
* 2006/02/05 官方国际版v6(Lite)固件制成
* 2006/03/02 NDSL于日本发售
* 2006/03/08 官方国际版v7(Lite)固件制成
* 2006/03/24 不晚于该日期（0225时官网标注v6），FlashMe_v7发布
* 2006/04/26 官方神游版iQue_v2 (Lite)固件制成
* 2006/04/17 不晚于该日期（0415时v7为旧版本），FlashMe_v7更新，用于初代ds的固件发生了些许改动，同时整合了用于dslite的固件，v7最初发布到更新期间，还存在独立的flashme_lite beta 1、beta 2版本
* 2006/06/01 NDSL于澳洲地区发售
* 2006/06/11 NDSL于北美地区发售
* 2006/06/22 NDSL于中国台湾发售
* 2006/06/23 NDSL于欧洲地区发售
* 2006/06/25 NDSL于新加坡发售
* 2006/06/29 NDSL于中国大陆以神游iQue名称发售
* 2006/07/20 NDSL于韩国发售（国际版固件）
* 2006/11/09 官方韩版Kor_v1 (Lite)固件制成

## 2007
* 2007/01/18 NDSL于韩国发售（韩版固件）
* 2007/04/30 FlashMe_v8发布
* 2007/05/01 FlashMe_v8a作为FlashMe最后的版本发布

