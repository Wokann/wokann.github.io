---
title: 修复大于16MB（超容）的GBA游戏，EEPROM格式存档失败问题
layout: post
author: wokann
excerpt: "eeprom存档的gba汉化rom超容，保存失败修复。"
---

# 前言
EEPROM格式的GBA游戏。<br>
存在汉化后大于16MB导致游戏保存失败的情况。<br>
故尝试借鉴铸剑3等32MB的EEPROM存档机制，制作EEPROM超容修复补丁。<br>

# 不同平台测试情况
| 平台                   | 汉化原版 | 汉化原版+SRAM补丁 | 汉化原版+EEPROM修复补丁 | 备注 |
| - | - | - | - | - |
| mgba                   | X | O*1 | O*2 | *1:mgba识别为SRAM格式进行存读档。<br>*2:mgba识别为EEPROM或SRAM格式均可进行存读档。
| no$gba                 | - | - | OX*3 | *3:
| vba                    | - | - | - |
| gbarunner2(ds/dsi/3ds) | O*4 | O*4 | O | *4:gbarunner2对eeprom游戏，会根据"EEPROM_Vxxx"字符串和读写函数的前16个字节机器码，进行自动打SRAM补丁，故原版超容游戏可被以SRAM方式存档。
| dstwo(tempgba)         | - | - | O |
| open_agb_firm          | X | X | O* | open_agb_firm的eeprom存档格式与常见模拟器不同，字节反序，使用其他模拟器生成的存档，需要使用工具转换后，放入存档目录方可读取。
| ezo/ezode              | X | O*5 | O*6 | *5:需手动设置为SRAM<br>*6:需手动设置为EEPROM8K或SRAM<br>*56:ezo的auto模式不可用于后两者，因其auto模式为读取rom头游戏码，来识别库内存储的存档格式，与SRAM及修复后的EEPROM无法兼容。<br>但若更改文件头游戏码为SRAM游戏或32MBEEPROM游戏的游戏码，则后两者可在auto模式中直接进去。
| SRAM国产卡(32MB)       | X | O | O | 
| AnaloguePocket(open_fpga) | X | X | O |



